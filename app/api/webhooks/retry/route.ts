import { assertRunApiAuthorized } from "../../../../lib/api-auth";
import { applyRateLimit } from "../../../../lib/rate-limit";
import { retryWebhookDelivery } from "../../../../lib/webhooks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = assertRunApiAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }
  const rateLimited = applyRateLimit(request, "webhookRetry");
  if (rateLimited) {
    return rateLimited;
  }

  let body: { deliveryId?: unknown };
  try {
    body = (await request.json()) as { deliveryId?: unknown };
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }

  const deliveryId =
    typeof body.deliveryId === "string" ? body.deliveryId.trim() : "";
  if (!deliveryId) {
    return new Response("deliveryId is required.", { status: 400 });
  }

  const retried = await retryWebhookDelivery(deliveryId);
  if (!retried) {
    return new Response("Webhook delivery not found.", { status: 404 });
  }

  return Response.json(retried);
}
