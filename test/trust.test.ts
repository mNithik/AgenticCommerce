import { describe, expect, it } from "vitest";
import { buildRunAttestation, verifyRunAttestation } from "../lib/trust";
import type { DiligenceRun } from "../lib/types";
import { makeDiligenceRun } from "./fixtures";

const run: DiligenceRun = {
  ...makeDiligenceRun({
    id: "run_trust",
    confidence: 0.5,
    proofScore: 63,
  }),
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
