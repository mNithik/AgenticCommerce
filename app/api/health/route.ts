import { buildHealthStatus } from "../../../lib/health";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(buildHealthStatus());
}
