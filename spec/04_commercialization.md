# Commercialization Strategy — Debt Recycler AU

## Market Opportunity

### Target Market

**Primary:** High-income property owners in Australia (age 35-60)
- Income: $120k+ annually (higher tax bracket = higher benefit from debt recycling)
- Assets: Home worth $500k+ with equity of $100k+
- Mindset: Long-term wealth builders, financially savvy

**Size:** ~850,000 high-income Australian property owners; ~20% actively seek wealth optimization = **170,000 TAM**

### Competitive Landscape

**Existing Players:**
- [Dark Horse Financial](https://darkhorsefinancial.com.au/debt-recycling-calculator/) — Free calculator, upsell to advisory
- [Hudson Financial Planning](https://hudsonfinancialplanning.com.au/) — Fee-based advisory
- [AUFinTools](https://debt-recycler.aufintools.com) — Free online tool
- Mortgage brokers (Shore Financial, etc.) — calculators as lead gen

**Advantage of debt-recycler-au.com:**
- Fully transparent, open-source specs (build trust)
- Personalized forecasting (age, income, risk profile)
- Scenario comparison (save & compare multiple plans)
- Direct output to PDF for financial advisor review

---

## Business Model Options

### Option 1: Freemium SaaS (Recommended)

**Free Tier:**
- Basic calculation (fixed parameters)
- Download PDF report
- Save up to 3 scenarios

**Premium Tier ($9.99/month or $99/year):**
- Unlimited scenarios
- Sensitivity analysis (auto-generate charts)
- Tax optimization recommendations
- Financial advisor collaboration (invite your advisor to review)
- Export to CSV, API access
- No ads, priority support

**B2B Tier (Custom):**
- White-label integration for mortgage brokers
- API access for financial advisors (embed in their software)
- Custom branding, analytics dashboard
- Lead capture (users who calculate → advisor referral)

**Revenue Projection (Year 1):**
- 10,000 free users (8% conversion from marketing)
- 2% convert to premium: 200 users × $99/year = $19,800
- 1 B2B partnership (mortgage broker): $5,000/month = $60,000
- **Total Year 1: ~$80k**

---

### Option 2: Advisory Services + Calculator

**Model:** Calculator is lead generation → sell advisory services

**Service Offerings:**
- Debt recycling strategy design ($500-$2k one-off)
- Portfolio optimization & rebalancing ($1-3k annually)
- Tax planning coordination with accountant ($500)

**Licensing:**
- Requires Australian Financial Services (AFS) License
- ~$5-10k cost, 12-week approval process
- Compliance overhead (annual audits, training)

**Revenue Projection:**
- 500 leads/month from calculator (500k visitors × 0.1% conversion)
- 10% close rate on advisory: 50 clients/month
- Average advisory spend: $1,500
- **Monthly revenue: $75k; Annual: $900k**

**Downside:** Requires regulatory approval, staffing, compliance costs (~$200k+ annually)

---

### Option 3: B2B2C (Partner-Focused)

**Model:** License calculator to financial advisors, mortgage brokers, banks

**Partners:**
- Mortgage brokers (lead gen for debt recycling deals)
- Financial advisory firms (client engagement tool)
- Banks (home loan retention tool)
- Accountants (cross-sell to tax optimization clients)

**Pricing:**
- Advisor tier: $199/month per user
- White-label: $5-10k setup + $2-5k/month
- API license: $10-50k/year based on volume

**Revenue Projection (Year 2):**
- 50 advisor accounts × $199/month = $9,900/month = $118,800/year
- 5 white-label partners × $5k/month = $300k/year
- **Total Year 2: ~$400k+**

---

## Recommended Go-To-Market Strategy

### Phase 1: Build Trust (Months 1-3)

1. **Free calculator launch**
   - Debt-recycler-au.com goes live (free tier)
   - 100% transparent specs, open on GitHub
   - Marketing: SEO, financial blogs, Reddit (AusFinance), Twitter

2. **Content strategy**
   - Blog posts: "Is debt recycling right for you?" (tax rules, case studies)
   - YouTube: 5-10 min explainers (your spreadsheet calculations)
   - Newsletter: Weekly tips for high-income property owners

3. **Advisor partnerships**
   - Reach out to 20 financial advisors (offer free white-label API access)
   - Collect feedback, testimonials
   - "Recommended by [Advisor Name]" trust signals

### Phase 2: Monetize (Months 4-6)

1. **Launch premium tier**
   - Sensitivity analysis, scenario comparison
   - Export to PDF with advisor notes
   - Tax optimization recommendations

2. **B2B outreach**
   - Target mortgage brokers: "Drive debt recycling deals with our calculator"
   - Target financial advisors: "Give clients a personalized strategy tool"

3. **Run paid ads**
   - Google Ads: "Debt recycling calculator for [high earner]"
   - Facebook: Target $120k+ household income, property owners
   - Budget: $2-5k/month

### Phase 3: Scale (Months 7-12)

1. **Partnerships with major players**
   - Approach banks (NAB, Westpac) for white-label integration
   - Approach Big 4 accounting firms for client tool
   - Approach fintech platforms (Sharesies, Spaceship, etc.)

2. **Explore AFS License** (if revenue justifies)
   - If premium + B2B hitting $200k+ ARR, consider advisory services
   - Hire licensed financial adviser (2-3 FTE)
   - Start selling customized debt recycling strategies

---

## Regulatory Considerations

### AFS License (NOT Required for Calculator Alone)

**Do NOT need AFS license if:**
- Calculator is purely educational (not advice)
- No personal recommendations ("You should borrow $X")
- Clear disclaimers: "Speak to a licensed financial adviser"

**DO need AFS license if:**
- Giving personalized advice based on user profile
- Recommending specific investments or strategies
- Charging for advisory services

### Compliance Strategy

**Recommended:** Launch with free calculator (no license needed). If moving to paid advisory (Option 2), then apply for AFS license.

**Terms & Conditions should include:**
- "Educational purposes only"
- "Consult a tax adviser / financial planner"
- "Past performance ≠ future results"
- "Assumes ETF dividend of 3%, cap appreciation 7%, etc. (these vary)"

### Tax Responsibility

- Users responsible for reporting investment income to ATO
- We provide PDF summaries they can give to their accountant
- No tax advice from us — purely calculations

---

## Technical Requirements for Commercialization

### For Premium Tier:

- User authentication (email + password or Google/GitHub login)
- Stripe integration (payments)
- Scenario storage (user DB)
- PDF export (jsPDF or server-side generation)
- Sensitivity analysis charts (Chart.js or Recharts)

### For B2B:

- API key authentication
- Rate limiting (requests/month)
- Webhook notifications (user signed up)
- Usage analytics dashboard
- SLA / uptime commitment (99.9%)

### For Licensing Compliance:

- Privacy policy (comply with Privacy Act)
- Terms of Service (clear disclaimers)
- Secure data handling (HTTPS, encryption at rest)
- GDPR compliance if EU users (unlikely, but prepare)

---

## Financial Projections (Year 1-3)

### Scenario: Freemium + B2B

| Year | Free Users | Premium Users | B2B Revenue | Total ARR | Notes |
|------|-----------|--------------|-----------|-----------|-------|
| 1 | 50k | 500 | $60k | $90k | Launch, organic growth |
| 2 | 150k | 2k | $300k | $500k | Paid marketing, partnerships |
| 3 | 300k | 5k | $800k | $1.5M | Loan broker integrations |

**Assumptions:**
- Free users → 1% convert to premium after 3 months
- B2B: 1 partner Year 1, 5 partners Year 2, 10+ partners Year 3
- Marketing spend: $10k Year 1, $30k Year 2, $60k Year 3

---

## Key Success Factors

1. **Accuracy:** Calculations must match ATO rules + spreadsheet model (±0.01%)
2. **Trust:** 100% transparent, educational tone, clear disclaimers
3. **Ease of Use:** Calculators are useless if confusing — 3-step input max
4. **Partnerships:** 80% of revenue will come from advisors/brokers (not direct users)
5. **Content:** SEO + educational content drives organic traffic (low CAC)

---

## Next Steps (to Rahul)

1. ✅ **Technical validation:** Build calculator, ensure accuracy
2. **Legal review:** Have a lawyer review Terms of Service (no AFS needed for free tier)
3. **Beta test:** 50 financial advisors trial white-label → collect feedback
4. **Design:** Professional branding, UX/UI for calculator
5. **Marketing:** Launch landing page, run $2k test ad campaign
6. **Measure:** Set Year 1 goal: 50k free users, 200 premium users, 1 B2B partner

---

## References

- [ATO: Capital Gains Tax](https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax)
- [ASIC: AFS License Requirements](https://www.asic.gov.au/for-finance-professionals/afs-licensees/)
- [Dark Horse Financial: Debt Recycling](https://darkhorsefinancial.com.au/debt-recycling/)
