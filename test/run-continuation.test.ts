import { describe, expect, it } from "vitest";
import {
  annotateGapsWithParent,
  counterSignalsFromParent,
  resolveParentRun,
} from "../lib/run-continuation";
import { clearRecentRuns } from "../lib/recent-runs";
import type { DiligenceRun } from "../lib/types";

const parentRun: DiligenceRun = {
  id: "run_parent",
  input: "Should I buy Apollo.io?",
  subject: "Apollo.io",
  budgetCapUsd: 0.25,
  spentUsd: 0.03,
  paidCalls: 3,
  paymentMode: "mock",
  llmProvider: "deterministic",
  policyProfile: "standard",
  recommendation: "need_more_evidence",
  confidence: 0.28,
  confidenceBreakdown: {
    overall: 0.28,
    agentSignals: [
      { agent: "Market", confidence: 0.5, ran: true, recordId: "rec_market" },
      { agent: "Evidence", confidence: 0.6, ran: true, recordId: "rec_evidence" },
      { agent: "Counter", negativity: 0.2, ran: true, recordId: "rec_counter" },
      { agent: "Skeptic", ran: false },
    ],
    factors: [],
    policyAdjustments: [],
  },
  proofScore: 37,
  proofScoreComponents: {
    overall: 0.28,
    citationCoverage: 0.67,
    runCompleteness: 1,
  },
  confidenceGaps: [],
  records: [
    {
      id: "rec_counter",
      agent: "Counter",
      query: "Apollo.io risks",
      normalizedQuery: "apollo io risks",
      provider: "Tavily x402 (mock)",
      paymentMode: "mock",
      costUsd: 0.01,
      receipt: "mock:counter",
      finding: "Counter finding",
      sources: [],
      policyStatus: "allowed",
    },
  ],
  memo: "memo",
  analystOutput: {
    recommendation: "need_more_evidence",
    confidence: 0.28,
    rationale: {
      id: "claim_rationale",
      claimText: "Mixed evidence.",
      recordIds: ["rec_counter"],
      sourceUrls: [],
    },
    strengths: [],
    concerns: [],
    nextSteps: [],
  },
  safeSpendLog: [],
};

describe("run continuation helpers", () => {
  it("resolves a parent run from client fallback when server memory is empty", () => {
    clearRecentRuns();

    const resolved = resolveParentRun(parentRun.id, parentRun);

    expect(resolved.id).toBe(parentRun.id);
  });

  it("builds counter signals from parent agent negativity instead of placeholders", () => {
    const signals = counterSignalsFromParent(parentRun);

    expect(signals).toEqual([
      {
        recordId: "rec_counter",
        negativity: 0.2,
        theme: undefined,
      },
    ]);
  });

  it("annotates confidence gaps with the active run id", () => {
    const gaps = annotateGapsWithParent(
      [
        {
          id: "gap-1",
          title: "Follow up",
          estimatedConfidenceGain: 0.08,
          estimatedCostUsd: 0.01,
          actionType: "paid_search",
        },
      ],
      "run_parent",
    );

    expect(gaps[0]?.parentRunId).toBe("run_parent");
  });
});
