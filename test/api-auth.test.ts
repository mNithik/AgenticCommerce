import { beforeEach, describe, expect, it, vi } from "vitest";

describe("assertRunApiAuthorized", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("allows requests when no API key is configured", async () => {
    vi.doMock("../lib/config", () => ({
      config: { apiAuthKey: undefined },
    }));

    const { assertRunApiAuthorized } = await import("../lib/api-auth");
    const request = new Request("http://localhost:3000/api/run-diligence", {
      method: "POST",
    });

    expect(assertRunApiAuthorized(request)).toBeNull();
  });

  it("returns 401 when bearer token is missing or invalid", async () => {
    vi.doMock("../lib/config", () => ({
      config: { apiAuthKey: "secret_key" },
    }));

    const { assertRunApiAuthorized } = await import("../lib/api-auth");
    const missing = new Request("http://localhost:3000/api/run-diligence", {
      method: "POST",
    });
    const wrong = new Request("http://localhost:3000/api/run-diligence", {
      method: "POST",
      headers: {
        Authorization: "Bearer wrong",
      },
    });

    expect(assertRunApiAuthorized(missing)?.status).toBe(401);
    expect(assertRunApiAuthorized(wrong)?.status).toBe(401);
  });

  it("accepts the configured bearer token", async () => {
    vi.doMock("../lib/config", () => ({
      config: { apiAuthKey: "secret_key" },
    }));

    const { assertRunApiAuthorized } = await import("../lib/api-auth");
    const request = new Request("http://localhost:3000/api/run-diligence", {
      method: "POST",
      headers: {
        Authorization: "Bearer secret_key",
      },
    });

    expect(assertRunApiAuthorized(request)).toBeNull();
  });
});
