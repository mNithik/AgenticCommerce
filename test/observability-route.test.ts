import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/observability", () => ({
  getObservabilityEvents: () => [
    {
      id: "obs_1",
      category: "run",
      status: "success",
      message: "Run completed.",
      timestamp: "2026-06-04T00:00:00.000Z",
    },
  ],
}));

import { GET } from "../app/api/observability/route";

describe("GET /api/observability", () => {
  it("returns recent observability events", async () => {
    const response = await GET(new Request("http://localhost:3000/api/observability"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body[0].id).toBe("obs_1");
  });
});
