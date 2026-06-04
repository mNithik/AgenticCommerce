import { describe, expect, it } from "vitest";
import { buildRunAttestation, verifyRunAttestation } from "../lib/trust";
import type { DiligenceRun } from "../lib/types";

const run: DiligenceRun = {
  id: "run_trust",
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

describe("trust attestation", () => {
  it("verifies digest-only attestations", async () => {
    const attestation = await buildRunAttestation(run);
    const result = await verifyRunAttestation(run, attestation);

    expect(result.verified).toBe(true);
    expect(result.digestMatch).toBe(true);
    expect(result.signatureMatch).toBeNull();
  });

  it("verifies signed attestations when the secret matches", async () => {
    const attestation = await buildRunAttestation(run, { secret: "proof_secret" });
    const result = await verifyRunAttestation(run, attestation, {
      secret: "proof_secret",
    });

    expect(result.verified).toBe(true);
    expect(result.signatureMatch).toBe(true);
  });
});
