import { assertRunApiAuthorized } from "../../../lib/api-auth";
import { getObservabilityEvents } from "../../../lib/observability";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = assertRunApiAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  return Response.json(getObservabilityEvents());
}
