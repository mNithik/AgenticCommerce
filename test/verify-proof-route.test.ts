import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRunAttestation, buildSnapshotEnvelope } from "../lib/trust";
import type { DiligenceRun, ProofPacketJson } from "../lib/types";
import { makeDiligenceRun } from "./fixtures";

const run: DiligenceRun = {
  ...makeDiligenceRun({
    id: "run_verify",
    confidence: 0.5,
    proofScore: 63,
  }),
};

function encodeSnapshot(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

describe("POST /api/verify-proof", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("verifies a proof packet payload", async () => {
    const attestation = await buildRunAttestation(run);
    const packet: ProofPacketJson = {
      metadata: {
        exportedAt: "2026-06-04T00:00:00.000Z",
        appName: "ProofSpend",
        exportFormatVersion: 2,
        attestation,
      },
      run,
    };

    const { POST } = await import("../app/api/verify-proof/route");
    const response = await POST(
      new Request("http://localhost:3000/api/verify-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proofPacket: packet }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.verified).toBe(true);
    expect(payload.signingMode).toBe("digest-only");
    expect(packet.run.confidenceBreakdown.factors.length).toBeGreaterThan(0);
  });

  it("verifies a signed snapshot when the server secret is available", async () => {
    vi.doMock("../lib/config", () => ({
      config: { proofSigningSecret: "proof_secret" },
    }));

    const envelope = await buildSnapshotEnvelope(run, { secret: "proof_secret" });
    const snapshot = encodeSnapshot(JSON.stringify(envelope));

    const { POST } = await import("../app/api/verify-proof/route");
    const response = await POST(
      new Request("http://localhost:3000/api/verify-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.verified).toBe(true);
    expect(payload.signatureMatch).toBe(true);
  });
});
