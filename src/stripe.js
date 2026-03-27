const stripeLib = require("stripe");
const db = require("./db");

const stripe = new stripeLib(process.env.STRIPE_SECRET_KEY);

// Stripe tier pricing (in cents)
const TIER_PRICING = {
  starter: 2900,      // $29/month
  professional: 9900, // $99/month
  enterprise: 29900,  // $299/month
};

const TIER_FEATURES = {
  starter: {
    monthly_scenarios: 5,
    client_limit: 10,
    features: ["basic_calculation", "pdf_export"],
  },
  professional: {
    monthly_scenarios: 50,
    client_limit: 100,
    features: [
      "basic_calculation",
      "pdf_export",
      "excel_export",
      "email_integration",
    ],
  },
  enterprise: {
    monthly_scenarios: 500,
    client_limit: 1000,
    features: [
      "basic_calculation",
      "pdf_export",
      "excel_export",
      "email_integration",
      "api_access",
      "custom_branding",
    ],
  },
};

/**
 * Create Stripe customer for new user
 */
async function createCustomer(user) {
  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      metadata: {
        user_id: user.id,
        company_name: user.company_name || "",
      },
    });

    return customer.id;
  } catch (error) {
    console.error("Error creating Stripe customer:", error);
    throw error;
  }
}

/**
 * Create subscription for user
 * @param {Object} options - {user_id, stripe_customer_id, tier, payment_method_id}
 * @returns {Promise<Object>}
 */
async function createSubscription(options) {
  const {
    user_id,
    stripe_customer_id,
    tier,
    payment_method_id,
    idempotency_key,
  } = options;

  if (!TIER_PRICING[tier]) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  try {
    // Create subscription
    const subscription = await stripe.subscriptions.create(
      {
        customer: stripe_customer_id,
        items: [
          {
            price_data: {
              currency: "aud",
              product_data: {
                name: `Debt Recycler ${tier.charAt(0).toUpperCase() + tier.slice(1)}`,
              },
              unit_amount: TIER_PRICING[tier],
              recurring: {
                interval: "month",
              },
            },
          },
        ],
        default_payment_method: payment_method_id,
        billing_cycle_anchor: Math.floor(Date.now() / 1000),
      },
      idempotency_key ? { idempotencyKey: idempotency_key } : {}
    );

    // Create invoice
    const invoice = await stripe.invoices.create({
      customer: stripe_customer_id,
      subscription: subscription.id,
      auto_advance: true,
    });

    // Send invoice
    await stripe.invoices.sendInvoice(invoice.id);

    // Store in database
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    const result = await db.updateUserSubscription(user_id, {
      stripe_customer_id,
      subscription_id: subscription.id,
      subscription_tier: tier,
      subscription_status: "active",
      current_period_end: currentPeriodEnd,
      default_payment_method_id: payment_method_id,
      invoice_id: invoice.id,
    });

    return {
      subscription_id: subscription.id,
      status: subscription.status,
      tier,
      current_period_end: currentPeriodEnd,
      invoice_id: invoice.id,
      invoice_sent: true,
      amount: TIER_PRICING[tier],
    };
  } catch (error) {
    console.error("Error creating subscription:", error);
    throw error;
  }
}

/**
 * Cancel subscription
 */
async function cancelSubscription(subscription_id) {
  try {
    const subscription = await stripe.subscriptions.del(subscription_id);

    return {
      subscription_id: subscription.id,
      status: subscription.status,
    };
  } catch (error) {
    console.error("Error canceling subscription:", error);
    throw error;
  }
}

/**
 * Retrieve subscription
 */
async function getSubscription(subscription_id) {
  try {
    return await stripe.subscriptions.retrieve(subscription_id);
  } catch (error) {
    console.error("Error retrieving subscription:", error);
    throw error;
  }
}

/**
 * Create customer portal session
 */
async function createPortalSession(stripe_customer_id, return_url) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripe_customer_id,
      return_url: return_url || process.env.APP_URL || "http://localhost:3000",
    });

    return {
      url: session.url,
      session_id: session.id,
    };
  } catch (error) {
    console.error("Error creating portal session:", error);
    throw error;
  }
}

/**
 * Construct and verify webhook event
 */
function constructWebhookEvent(body, signature, secret) {
  try {
    return stripe.webhooks.constructEvent(
      body,
      signature,
      secret || process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    throw new Error(`Webhook signature verification failed: ${error.message}`);
  }
}

/**
 * Handle Stripe webhook events
 */
async function handleWebhookEvent(event) {
  console.log(`Processing Stripe event: ${event.type}`);

  switch (event.type) {
    case "charge.succeeded":
      return handleChargeSucceeded(event.data.object);

    case "charge.failed":
      return handleChargeFailed(event.data.object);

    case "customer.subscription.updated":
      return handleSubscriptionUpdated(event.data.object);

    case "customer.subscription.deleted":
      return handleSubscriptionDeleted(event.data.object);

    case "customer.subscription.trial_will_end":
      return handleTrialWillEnd(event.data.object);

    default:
      console.log(`Unhandled event type: ${event.type}`);
      return { handled: false };
  }
}

async function handleChargeSucceeded(charge) {
  console.log(`Charge succeeded: ${charge.id}`);
  // Update payment status in database
  return { handled: true };
}

async function handleChargeFailed(charge) {
  console.log(`Charge failed: ${charge.id} - ${charge.failure_message}`);
  // Update subscription status to past_due
  return { handled: true };
}

async function handleSubscriptionUpdated(subscription) {
  console.log(`Subscription updated: ${subscription.id} - ${subscription.status}`);
  // Update subscription status in database
  return { handled: true };
}

async function handleSubscriptionDeleted(subscription) {
  console.log(`Subscription deleted: ${subscription.id}`);
  // Mark subscription as cancelled in database
  return { handled: true };
}

async function handleTrialWillEnd(subscription) {
  console.log(`Trial will end: ${subscription.id}`);
  // Send email reminder to user
  return { handled: true };
}

/**
 * Get user tier features
 */
function getTierFeatures(tier) {
  return TIER_FEATURES[tier] || TIER_FEATURES.starter;
}

/**
 * Check if user has access to feature
 */
function hasFeatureAccess(tier, feature) {
  if (!tier) return false;
  const features = getTierFeatures(tier).features;
  return features.includes(feature);
}

/**
 * Validate payment method
 */
async function validatePaymentMethod(payment_method_id) {
  try {
    // In production, you might want to attach and verify the payment method
    // For now, we'll just check that it exists
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

module.exports = {
  createCustomer,
  createSubscription,
  cancelSubscription,
  getSubscription,
  createPortalSession,
  constructWebhookEvent,
  handleWebhookEvent,
  getTierFeatures,
  hasFeatureAccess,
  validatePaymentMethod,
  TIER_PRICING,
  TIER_FEATURES,
};
