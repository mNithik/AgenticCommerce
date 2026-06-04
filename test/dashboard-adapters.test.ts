import { describe, expect, it } from "vitest";
import { analystToMemoView, runToHistoryRow } from "../lib/dashboard-adapters";
import type { AnalystOutput, DiligenceRun, EvidenceRecord } from "../lib/types";

const record: EvidenceRecord = {
  id: "record_market",
  agent: "Market",
  query: "Apollo.io market size category competitors pricing",
  normalizedQuery: "apollo io market size category competitors pricing",
  provider: "Tavily x402",
  paymentMode: "live",
  costUsd: 0.01,
  receipt: "0x1234567890abcdef",
  finding: "Apollo.io is an established sales-intelligence vendor.",
  policyStatus: "allowed",
  sources: [
    {
      title: "Apollo pricing",
      url: "https://www.apollo.io/pricing",
      snippet: "Apollo.io pricing details",
    },
  ],
};

const analystOutput: AnalystOutput = {
  recommendation: "need_more_evidence",
  confidence: 0.64,
  rationale: {
    id: "claim_rationale",
    claimText: "Apollo.io has clear category fit, but ROI remains mixed at this budget.",
    recordIds: ["record_market"],
    sourceUrls: ["https://www.apollo.io/pricing"],
  },
  strengths: [
    {
      id: "claim_strength_1",
      claimText: "Apollo.io is a known vendor in a proven category.",
      recordIds: ["record_market"],
      sourceUrls: ["https://www.apollo.io/pricing"],
    },
  ],
  concerns: [],
  nextSteps: [],
};

const run: DiligenceRun = {
  id: "run_abc123",
  input: "Should I spend $500 per month on Apollo.io for B2B lead generation?",
  subject: "Apollo.io",
  budgetCapUsd: 0.25,
  spentUsd: 0.03,
  paidCalls: 3,
  paymentMode: "live",
  llmProvider: "nvidia",
  policyProfile: "standard",
  recommendation: "need_more_evidence",
  confidence: 0.64,
  memo: "Apollo.io may fit, but more validation is needed.",
  records: [record],
  analystOutput,
  safeSpendLog: [],
};

describe("dashboard adapters", () => {
  it("maps memo claims to citation-ready view data", () => {
    const memo = analystToMemoView(analystOutput, [record]);

    expect(memo).not.toBeNull();
    expect(memo?.rationale.citations).toEqual([
      {
        recordId: "record_market",
        agent: "market",
        receipt: "0x1234567890abcdef",
        paymentMode: "live",
      },
    ]);
    expect(memo?.strengths[0].text).toContain("known vendor");
  });

  it("keeps history labels clean and exposes counts separately", () => {
    const row = runToHistoryRow(run);

    expect(row.subject).toBe("Apollo.io");
    expect(row.paidCalls).toBe(3);
    expect(row.records).toBe(1);
  });
});
