import { describe, expect, it } from "vitest";
import { applyRateLimit } from "../lib/rate-limit";

describe("rate limits", () => {
  it("blocks after the configured run-diligence threshold", () => {
    let response: Response | null = null;

    for (let attempt = 0; attempt < 9; attempt += 1) {
      response = applyRateLimit(
        new Request("http://localhost:3000/api/run-diligence", {
          method: "POST",
          headers: {
            "x-forwarded-for": "test-client-rate-limit",
          },
        }),
        "runDiligence",
      );
    }

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBeTruthy();
  });
});
