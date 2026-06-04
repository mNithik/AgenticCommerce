export const EXAMPLE_QUESTIONS = [
  {
    short: "Apollo.io lead gen",
    full: "Should I spend $500 per month on Apollo.io for B2B lead generation for my early-stage SaaS startup?",
  },
  {
    short: "HubSpot Enterprise",
    full: "Should I buy HubSpot Enterprise for our 20-person sales team?",
  },
  {
    short: "LeadMagic",
    full: "Should we switch to LeadMagic for AI-powered lead enrichment at $99/seat?",
  },
] as const;

export const DEMO_QUESTION = EXAMPLE_QUESTIONS[0].full;
