const db = require("./db");
const { getTierFeatures, hasFeatureAccess } = require("./stripe");
const { verifyToken } = require("./auth");

// In-memory rate limit store (in production, use Redis)
const rateLimitStore = new Map();

/**
 * Tier-based access control middleware
 * @param {string} requiredTier - Minimum tier required ('starter', 'professional', 'enterprise')
 */
function tierMiddleware(requiredTier) {
  return async (req, res, next) => {
    try {
      // Skip check for admin users
      if (req.user?.role === "admin") {
        return next();
      }

      // Get user from database
      const user = await db.getUser(req.user.user_id || req.user.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Check if user is in trial period
      if (user.trial_ends_at && new Date(user.trial_ends_at) > new Date()) {
        // Trial users have professional tier access
        const tierHierarchy = { starter: 1, professional: 2, enterprise: 3 };
        const requiredLevel = tierHierarchy[requiredTier] || 1;
        const trialLevel = tierHierarchy["professional"]; // Professional access during trial

        if (trialLevel >= requiredLevel) {
          return next();
        }
      }

      // Check subscription tier
      const tierHierarchy = { starter: 1, professional: 2, enterprise: 3 };
      const userTierLevel = (user.subscription_status === 'active' || user.subscription_status === null)
        ? (tierHierarchy[user.subscription_tier] || 0)
        : 0;
      const requiredLevel = tierHierarchy[requiredTier] || 1;

      if (userTierLevel >= requiredLevel) {
        return next();
      }

      // Subscription cancelled - return 403
      if (user.subscription_status === 'cancelled') {
        return res.status(403).json({
          error: 'Subscription cancelled',
          tier_required: requiredTier,
          upgrade_url: "/billing/upgrade",
        });
      }

      // Tier insufficient - return 402 Payment Required
      return res.status(402).json({
        error: `${requiredTier} subscription required`,
        tier_required: requiredTier,
        upgrade_url: "/billing/upgrade",
        current_tier: user.subscription_tier || "free",
      });
    } catch (error) {
      console.error("Tier middleware error:", error);
      res.status(500).json({ error: error.message });
    }
  };
}

/**
 * Rate limiting middleware
 * Limits based on subscription tier
 */
async function rateLimitMiddleware(req, res, next) {
  try {
    const userId = req.user?.user_id || req.user?.userId;
    const now = Math.floor(Date.now() / 1000);
    const hour = Math.floor(now / 3600) * 3600;

    // Determine rate limit based on tier (or IP if not authenticated)
    const key = userId ? `user:${userId}` : `ip:${req.ip}`;
    const tierLimits = {
      free: 100,
      starter: 1000,
      professional: 10000,
      enterprise: 100000,
    };

    let limit = tierLimits.free; // Default to free tier limit

    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const decoded = verifyToken(authHeader.slice(7));
          if (decoded) effectiveUserId = decoded.userId || decoded.user_id;
        } catch (_) {}
      }
    }

    if (effectiveUserId) {
      const subscriptionTier = req.user?.subscription_tier;
      if (subscriptionTier) {
        limit = tierLimits[subscriptionTier] || tierLimits.free;
      } else {
        try {
          const user = await db.getUser(effectiveUserId);
          if (user?.subscription_tier) {
            limit = tierLimits[user.subscription_tier] || tierLimits.free;
          }
        } catch (_) {}
      }
    }

    // Get current count for this hour
    const storeKey = `${key}:${hour}`;
    let count = rateLimitStore.get(storeKey) || 0;
    count++;

    rateLimitStore.set(storeKey, count);

    // Clean up old entries
    const fiveHoursAgo = hour - 5 * 3600;
    for (const k of rateLimitStore.keys()) {
      const keyHour = parseInt(k.split(":").pop());
      if (keyHour < fiveHoursAgo) {
        rateLimitStore.delete(k);
      }
    }

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - count));
    res.setHeader("X-RateLimit-Reset", hour + 3600);

    // Check if limit exceeded
    if (count > limit) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        limit,
        remaining: 0,
        reset_at: new Date((hour + 3600) * 1000).toISOString(),
      });
    }

    next();
  } catch (error) {
    console.error("Rate limit middleware error:", error);
    next(); // Don't block on error
  }
}

/**
 * Usage quota enforcement middleware
 * Tracks monthly scenario/client limits
 */
function quotaMiddleware(resourceType) {
  return async (req, res, next) => {
    try {
      const user = await db.getUser(req.user.user_id || req.user.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Skip quota check for admin
      if (user.role === "admin") {
        return next();
      }

      // Get tier limits
      const tierLimits = {
        free: { scenarios: 3, clients: 5 },
        starter: { scenarios: 5, clients: 10 },
        professional: { scenarios: 50, clients: 100 },
        enterprise: { scenarios: 500, clients: 1000 },
      };

      const tierKey = user.subscription_tier || "free";
      const limits = tierLimits[tierKey] || tierLimits.free;

      // Check if on trial (gets professional limits)
      if (
        user.trial_ends_at &&
        new Date(user.trial_ends_at) > new Date()
      ) {
        Object.assign(limits, tierLimits.professional);
      }

      // Reset quota if billing cycle has ended
      if (user.current_period_end && new Date(user.current_period_end) < new Date()) {
        await db.pool.query(
          'UPDATE users SET monthly_scenarios_used = 0, monthly_clients_used = 0 WHERE id = $1',
          [user.id]
        );
        user.monthly_scenarios_used = 0;
        user.monthly_clients_used = 0;
      }

      // Check quota based on resource type
      if (resourceType === "scenario") {
        const monthlyUsed = user.monthly_scenarios_used || 0;
        const limit = limits.scenarios;

        // Check if quota exceeded
        if (monthlyUsed >= limit) {
          return res.status(402).json({
            error: "Monthly scenario quota exceeded",
            monthly_limit: limit,
            monthly_used: monthlyUsed,
            reset_date: user.current_period_end || new Date(),
          });
        }

        // Store quota info in request for later update
        req.quotaInfo = { type: "scenario", limit, used: monthlyUsed };
      } else if (resourceType === "client") {
        const monthlyUsed = user.monthly_clients_used || 0;
        const limit = limits.clients;

        if (monthlyUsed >= limit) {
          return res.status(402).json({
            error: "Monthly client quota exceeded",
            monthly_limit: limit,
            monthly_used: monthlyUsed,
            reset_date: user.current_period_end || new Date(),
          });
        }

        req.quotaInfo = { type: "client", limit, used: monthlyUsed };
      }

      next();
    } catch (error) {
      console.error("Quota middleware error:", error);
      next(); // Don't block on error
    }
  };
}

/**
 * Feature availability middleware
 * Adds available features to response
 */
function featureAvailabilityMiddleware(req, res, next) {
  const userId = req.user?.user_id || req.user?.userId;

  const applyFeatures = (tier) => {
    const features = getTierFeatures(tier).features;
    req.availableFeatures = features;
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      if (typeof data === "object" && data !== null) {
        data.available_features = features;
      }
      return originalJson(data);
    };
    next();
  };

  if (userId) {
    db.getUser(userId).then(user => {
      applyFeatures(user?.subscription_tier || "free");
    }).catch(() => {
      applyFeatures(req.user?.subscription_tier || "free");
    });
  } else {
    applyFeatures(req.user?.subscription_tier || "free");
  }
}

/**
 * Helper to get tier features for a user
 */
async function getUserTierFeatures(userId) {
  try {
    const user = await db.getUser(userId);
    if (!user) {
      return getTierFeatures("free");
    }

    // Check if in trial
    if (
      user.trial_ends_at &&
      new Date(user.trial_ends_at) > new Date()
    ) {
      return getTierFeatures("professional");
    }

    return getTierFeatures(user.subscription_tier || "free");
  } catch (error) {
    console.error("Error getting user tier features:", error);
    return getTierFeatures("free");
  }
}

/**
 * Helper to check if user has access to feature
 */
async function userHasFeatureAccess(userId, feature) {
  const features = await getUserTierFeatures(userId);
  return features.features.includes(feature);
}

module.exports = {
  tierMiddleware,
  rateLimitMiddleware,
  quotaMiddleware,
  featureAvailabilityMiddleware,
  getUserTierFeatures,
  userHasFeatureAccess,
};
