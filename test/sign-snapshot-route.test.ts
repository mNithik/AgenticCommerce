import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiligenceRun } from "../lib/types";
import { makeDiligenceRun } from "./fixtures";

const run: DiligenceRun = {
  ...makeDiligenceRun({
    id: "run_snapshot_route",
    confidence: 0.5,
    proofScore: 63,
  }),
};

function buildRequest(authorization?: string) {
  return new Request("http://localhost:3000/api/sign-snapshot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify({ run }),
  });
}

describe("POST /api/sign-snapshot", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns an attested snapshot when auth is open", async () => {
    vi.doMock("../lib/config", async () => {
      const actual = await vi.importActual<typeof import("../lib/config")>("../lib/config");
      return {
        ...actual,
        config: {
          ...actual.config,
          apiAuthKey: undefined,
          proofSigningSecret: undefined,
        },
      };
    });

    const { POST } = await import("../app/api/sign-snapshot/route");
    const response = await POST(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.snapshot).toBeTruthy();
    expect(payload.attestation.signingMode).toBe("digest-only");
  });

  it("requires auth when the API key is configured", async () => {
    vi.doMock("../lib/config", async () => {
      const actual = await vi.importActual<typeof import("../lib/config")>("../lib/config");
      return {
        ...actual,
        config: {
          ...actual.config,
          apiAuthKey: "secret_key",
          proofSigningSecret: "proof_secret",
        },
      };
    });

    const { POST } = await import("../app/api/sign-snapshot/route");
    const unauthorized = await POST(buildRequest());
    const authorized = await POST(buildRequest("Bearer secret_key"));
    const payload = await authorized.json();

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
    expect(payload.attestation.signingMode).toBe("hmac-sha256");
  });
});
