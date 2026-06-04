import { describe, expect, it } from "vitest";
import {
  buildProofPacketFilename,
  buildProofPacketJson,
  buildProofPacketMarkdown,
} from "../lib/proof-packet";
import type { DiligenceRun } from "../lib/types";

const baseRun: DiligenceRun = {
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
  confidence: 0.62,
  memo: "Apollo.io appears promising, but sales-team fit and list quality need validation.",
  records: [
    {
      id: "record_market",
      agent: "Market",
      query: "Apollo.io market size category competitors pricing",
      normalizedQuery: "apollo io market size category competitors pricing",
      provider: "Tavily x402",
      paymentMode: "live",
      costUsd: 0.01,
      receipt: "0x123abc",
      finding: "Apollo.io sits in a crowded but growing sales-intelligence category.",
      policyStatus: "allowed",
      sources: [
        {
          title: "Apollo Pricing",
          url: "https://www.apollo.io/pricing",
          snippet: "Apollo.io pricing details",
        },
      ],
    },
  ],
  analystOutput: {
    recommendation: "need_more_evidence",
    confidence: 0.62,
    rationale: {
      id: "claim_rationale",
      claimText: "Apollo.io could work, but current evidence is mixed on ROI at this budget.",
      recordIds: ["record_market"],
      sourceUrls: ["https://www.apollo.io/pricing"],
    },
    strengths: [
      {
        id: "claim_strength_1",
        claimText: "The category is established and Apollo.io is a known vendor.",
        recordIds: ["record_market"],
        sourceUrls: ["https://www.apollo.io/pricing"],
      },
    ],
    concerns: [
      {
        id: "claim_concern_1",
        claimText: "Crowded alternatives make differentiation unclear.",
        recordIds: ["record_market"],
        sourceUrls: ["https://www.apollo.io/pricing"],
      },
    ],
    nextSteps: [
      {
        id: "claim_next_1",
        claimText: "Validate list quality with a narrow trial before committing.",
        recordIds: ["record_market"],
        sourceUrls: ["https://www.apollo.io/pricing"],
      },
    ],
  },
  safeSpendLog: [
    {
      agent: "Market",
      action: "preflight",
      status: "allowed",
      reason: "Within budget.",
      queryPreview: "Apollo.io market size category competitors pricing",
      projectedSpendUsd: 0.01,
    },
  ],
};

describe("proof packet export", () => {
  it("wraps a completed run in export metadata", async () => {
    const packet = await buildProofPacketJson(baseRun);
    const parsed = JSON.parse(JSON.stringify(packet));

    expect(packet.metadata.appName).toBe("ProofSpend");
    expect(packet.metadata.exportFormatVersion).toBe(2);
    expect(packet.metadata.attestation.digest).toBeTruthy();
    expect(parsed.run.records[0].receipt).toBe("0x123abc");
  });

  it("builds a safe filename from the subject and run id", () => {
    expect(buildProofPacketFilename(baseRun, "json")).toBe(
      "proofspend-apollo-io-run_run_abc123.json",
    );
  });

  it("renders live markdown with traceability and receipt links", async () => {
    const markdown = await buildProofPacketMarkdown(baseRun);

    expect(markdown).toContain("# ProofSpend Proof Packet");
    expect(markdown).toContain("Question: Should I spend $500 per month on Apollo.io");
    expect(markdown).toContain("## Verification");
    expect(markdown).toContain("Trace: record ids: record_market | sources: https://www.apollo.io/pricing");
    expect(markdown).toContain("[0x123abc](https://basescan.org/tx/0x123abc)");
    expect(markdown).toContain("## SafeSpend Log");
  });

  it("labels mock receipts as simulated in markdown", async () => {
    const mockRun: DiligenceRun = {
      ...baseRun,
      paymentMode: "mock",
      records: [
        {
          ...baseRun.records[0],
          paymentMode: "mock",
          provider: "Tavily x402 (mock)",
          receipt: "mock:0xabc",
        },
      ],
    };

    const markdown = await buildProofPacketMarkdown(mockRun);

    expect(markdown).toContain("simulated receipt (mock:0xabc)");
  });
});
