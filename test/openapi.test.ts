import { describe, expect, it } from "vitest";
import { GET } from "../app/api/openapi/route";
import { proofSpendOpenApi } from "../lib/openapi";

describe("ProofSpend OpenAPI", () => {
  it("documents the public API routes and auth scheme", () => {
    expect(proofSpendOpenApi.paths["/api/run-diligence"]).toBeDefined();
    expect(proofSpendOpenApi.paths["/api/health"]).toBeDefined();
    expect(proofSpendOpenApi.paths["/api/openapi"]).toBeDefined();
    expect(proofSpendOpenApi.paths["/api/mcp"]).toBeDefined();
    expect(proofSpendOpenApi.paths["/api/schedules"]).toBeDefined();
    expect(proofSpendOpenApi.paths["/api/observability"]).toBeDefined();
    expect(proofSpendOpenApi.paths["/api/webhooks/retry"]).toBeDefined();
    expect(proofSpendOpenApi.paths["/api/sign-snapshot"]).toBeDefined();
    expect(proofSpendOpenApi.paths["/api/verify-proof"]).toBeDefined();
    expect(proofSpendOpenApi.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(
      proofSpendOpenApi.components.schemas.RunDiligenceRequest.properties,
    ).toHaveProperty("callbackUrl");
    expect(
      proofSpendOpenApi.components.schemas.RunDiligenceRequest.properties,
    ).toHaveProperty("parentRunId");
    expect(
      proofSpendOpenApi.components.schemas.RunDiligenceRequest.properties,
    ).toHaveProperty("gapId");
    expect(
      proofSpendOpenApi.components.schemas.RunDiligenceRequest.properties,
    ).toHaveProperty("suggestedQuery");
    expect(
      proofSpendOpenApi.components.schemas.RunDiligenceRequest.properties,
    ).toHaveProperty("stream");
    expect(
      proofSpendOpenApi.components.schemas.HealthStatusResponse.properties,
    ).toHaveProperty("uptimeSeconds");
    expect(
      proofSpendOpenApi.components.schemas.HealthStatusResponse.properties,
    ).toHaveProperty("estimatedConfidenceRange");
    expect(
      proofSpendOpenApi.components.schemas.DiligenceRun.properties,
    ).toHaveProperty("webhookDelivery");
    expect(
      proofSpendOpenApi.components.schemas.DiligenceRun.properties,
    ).toHaveProperty("confidenceBreakdown");
    expect(
      proofSpendOpenApi.components.schemas.DiligenceRun.properties,
    ).toHaveProperty("proofScore");
    expect(
      proofSpendOpenApi.components.schemas.DiligenceRun.properties,
    ).toHaveProperty("confidenceGaps");
    expect(
      proofSpendOpenApi.components.schemas.DiligenceRun.properties,
    ).toHaveProperty("parentRunId");
    expect(
      proofSpendOpenApi.components.schemas.DiligenceRun.properties,
    ).toHaveProperty("continuedFromGapId");
  });

  it("serves the OpenAPI document from the route", async () => {
    const response = await GET();
    const payload = (await response.json()) as typeof proofSpendOpenApi;

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.openapi).toBe("3.1.0");
    expect(payload.paths["/api/openapi"]).toBeDefined();
    expect(payload.paths["/api/mcp"]).toBeDefined();
    expect(payload.paths["/api/verify-proof"]).toBeDefined();
    expect(payload.paths["/api/run-diligence"].post.security).toEqual([
      { bearerAuth: [] },
    ]);
  });
});
