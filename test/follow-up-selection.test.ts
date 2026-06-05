import { describe, expect, it } from "vitest";
import { selectFollowUps } from "../lib/follow-up-selection";

describe("selectFollowUps", () => {
  const parsedQuestion = {
    subject: "Apollo.io",
    spendSignal: "$500/month",
    companyStage: "early-stage" as const,
    intents: ["pricing", "legal_compliance"] as const,
    riskThemes: ["pricing_validation", "legal_resolution"] as const,
    spendSensitive: true,
  };

  it("avoids exact duplicate follow-up queries", () => {
    const result = selectFollowUps({
      records: [
        {
          id: "rec_counter",
          agent: "Counter",
          query: "Apollo.io lawsuit settlement status privacy compliance 2026",
          normalizedQuery: "apollo io lawsuit settlement status privacy compliance 2026",
          provider: "Tavily x402 (mock)",
          paymentMode: "mock",
          costUsd: 0.01,
          receipt: "mock:counter",
          finding: "Counter finding",
          sources: [],
          policyStatus: "allowed",
        },
      ],
      gaps: [
        {
          id: "gap-duplicate",
          title: "Validate legal resolution",
          estimatedConfidenceGain: 0.1,
          estimatedCostUsd: 0.01,
          suggestedQuery: "Apollo.io lawsuit settlement status privacy compliance 2026",
          actionType: "paid_search",
          focusAgent: "Counter",
          theme: "legal_resolution",
          priority: 90,
        },
      ],
      parsedQuestion,
      remainingBudget: 0.05,
      remainingPaidCallSlots: 2,
      estimatedPaidCallCostUsd: 0.01,
    });

    expect(result).toHaveLength(0);
  });

  it("caps counter legal follow-ups at one and prefers validation for the second slot", () => {
    const result = selectFollowUps({
      records: [],
      gaps: [
        {
          id: "gap-legal-1",
          title: "Validate legal resolution",
          estimatedConfidenceGain: 0.1,
          estimatedCostUsd: 0.01,
          suggestedQuery: "Apollo.io lawsuit settlement status privacy compliance 2026",
          actionType: "paid_search",
          focusAgent: "Counter",
          theme: "legal_resolution",
          priority: 95,
        },
        {
          id: "gap-legal-2",
          title: "Validate more legal resolution",
          estimatedConfidenceGain: 0.09,
          estimatedCostUsd: 0.01,
          suggestedQuery: "Apollo.io lawsuit settlement status customer complaints 2026",
          actionType: "paid_search",
          focusAgent: "Counter",
          theme: "legal_resolution",
          priority: 90,
        },
        {
          id: "gap-validation",
          title: "Validate ROI and contract terms",
          estimatedConfidenceGain: 0.08,
          estimatedCostUsd: 0.02,
          suggestedQuery: "Apollo.io pricing contract terms ROI implementation references",
          actionType: "paid_search",
          focusAgent: "Evidence",
          theme: "pricing_validation",
          priority: 88,
        },
      ],
      parsedQuestion,
      remainingBudget: 0.05,
      remainingPaidCallSlots: 2,
      estimatedPaidCallCostUsd: 0.01,
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.theme).toBe("legal_resolution");
    expect(result[1]?.theme).toBe("pricing_validation");
  });

  it("skips near-duplicate follow-up queries by token overlap", () => {
    const result = selectFollowUps({
      records: [],
      gaps: [
        {
          id: "gap-a",
          title: "Validate legal resolution",
          estimatedConfidenceGain: 0.1,
          estimatedCostUsd: 0.01,
          suggestedQuery: "Apollo.io lawsuit settlement status privacy compliance 2026",
          actionType: "paid_search",
          focusAgent: "Counter",
          theme: "legal_resolution",
          priority: 95,
        },
        {
          id: "gap-b",
          title: "Validate legal resolution again",
          estimatedConfidenceGain: 0.09,
          estimatedCostUsd: 0.01,
          suggestedQuery: "privacy compliance Apollo.io lawsuit settlement status 2026",
          actionType: "paid_search",
          focusAgent: "Counter",
          theme: "legal_resolution",
          priority: 94,
        },
      ],
      parsedQuestion,
      remainingBudget: 0.05,
      remainingPaidCallSlots: 2,
      estimatedPaidCallCostUsd: 0.01,
    });

    expect(result).toHaveLength(1);
  });
});
