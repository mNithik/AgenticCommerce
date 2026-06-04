import { describe, expect, it, vi } from "vitest";
import { buildWebhookHeaders } from "../lib/webhooks";

vi.mock("../lib/config", () => ({
  config: {
    webhookSecret: "test_secret",
    webhookMaxAttempts: 3,
  },
}));

describe("webhook headers", () => {
  it("adds timestamp and signature headers when a secret is configured", () => {
    const headers = buildWebhookHeaders('{"ok":true}', "2026-06-04T12:00:00.000Z");

    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-ProofSpend-Timestamp"]).toBe("2026-06-04T12:00:00.000Z");
    expect(headers["X-ProofSpend-Signature"]).toMatch(/^sha256=/);
  });
});
