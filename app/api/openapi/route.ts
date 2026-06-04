import { proofSpendOpenApi } from "../../../lib/openapi";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(proofSpendOpenApi, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
