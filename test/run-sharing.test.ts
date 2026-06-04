import { describe, expect, it } from "vitest";
import { deserializeRunSnapshot, parseRunSnapshot, serializeRunSnapshot } from "../lib/run-sharing";
import type { DiligenceRun } from "../lib/types";

const run: DiligenceRun = {
  id: "run_snapshot",
  input: "Should I buy Apollo.io?",
  subject: "Apollo.io",
  budgetCapUsd: 0.25,
  spentUsd: 0.03,
  paidCalls: 3,
  paymentMode: "mock",
  llmProvider: "deterministic",
  policyProfile: "standard",
  recommendation: "need_more_evidence",
  confidence: 0.5,
  records: [],
  memo: "memo",
  analystOutput: {
    recommendation: "need_more_evidence",
    confidence: 0.5,
    rationale: { id: "claim_1", claimText: "Mixed.", recordIds: [], sourceUrls: [] },
    strengths: [],
    concerns: [],
    nextSteps: [],
  },
  safeSpendLog: [],
};

describe("run snapshot sharing", () => {
  it("round-trips a completed run", async () => {
    const encoded = await serializeRunSnapshot(run);
    const decoded = deserializeRunSnapshot(encoded);
    const envelope = parseRunSnapshot(encoded);

    expect(decoded?.id).toBe(run.id);
    expect(decoded?.subject).toBe(run.subject);
    expect(decoded?.policyProfile).toBe("standard");
    expect(envelope?.attestation.digest).toBeTruthy();
  });
});
