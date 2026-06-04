import crypto from "node:crypto";
import { config } from "./config";
import { makeId } from "./text-utils";
import type { DiligenceRun, WebhookDeliveryStatus } from "./types";
import { recordObservabilityEvent } from "./observability";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildWebhookHeaders(payload: string, timestamp: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-ProofSpend-Timestamp": timestamp,
  };

  if (config.webhookSecret) {
    const signature = crypto
      .createHmac("sha256", config.webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");
    headers["X-ProofSpend-Signature"] = `sha256=${signature}`;
  }

  return headers;
}

const recentWebhookDeliveries: WebhookDeliveryStatus[] = [];
const deliveryRuns = new Map<string, DiligenceRun>();

function recordWebhookDelivery(delivery: WebhookDeliveryStatus) {
  recentWebhookDeliveries.unshift(delivery);
  if (recentWebhookDeliveries.length > 20) {
    recentWebhookDeliveries.length = 20;
  }
}

export function getRecentWebhookDeliveries() {
  return recentWebhookDeliveries.slice(0, 10);
}

export function findWebhookDelivery(deliveryId: string) {
  return recentWebhookDeliveries.find((delivery) => delivery.id === deliveryId) ?? null;
}

export async function retryWebhookDelivery(deliveryId: string) {
  const delivery = findWebhookDelivery(deliveryId);
  const run = delivery ? deliveryRuns.get(deliveryId) : undefined;

  if (!delivery || !run) {
    return null;
  }

  const retried = await deliverRunWebhook(delivery.callbackUrl, run);
  recordObservabilityEvent({
    category: "webhook",
    status: retried.status === "delivered" ? "success" : "error",
    message: `Retried webhook delivery for ${run.subject}.`,
    relatedId: retried.id,
    metadata: {
      runId: run.id,
      callbackUrl: delivery.callbackUrl,
      attempts: retried.attempts,
    },
  });
  return retried;
}

export async function deliverRunWebhook(
  callbackUrl: string,
  run: DiligenceRun,
) {
  const payload = JSON.stringify(run);
  const timestamp = new Date().toISOString();
  const headers = buildWebhookHeaders(payload, timestamp);
  const maxAttempts = Math.max(1, config.webhookMaxAttempts);

  let lastError: Error | undefined;
  let lastStatus: number | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers,
        body: payload,
      });

      if (response.ok) {
        const delivery: WebhookDeliveryStatus = {
          id: makeId("wh", `${run.id}_${callbackUrl}_${Date.now()}`),
          runId: run.id,
          callbackUrl,
          status: "delivered",
          attempts: attempt,
          deliveredAt: new Date().toISOString(),
          httpStatus: response.status,
        };
        deliveryRuns.set(delivery.id, run);
        recordWebhookDelivery(delivery);
        recordObservabilityEvent({
          category: "webhook",
          status: "success",
          message: `Webhook delivered for ${run.subject}.`,
          relatedId: delivery.id,
          metadata: {
            runId: run.id,
            callbackUrl,
            attempts: attempt,
            httpStatus: response.status,
          },
        });
        return delivery;
      }

      lastStatus = response.status;
      lastError = new Error(
        `Webhook delivery failed with status ${response.status}.`,
      );
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Unknown webhook delivery failure.");
    }

    if (attempt < maxAttempts) {
      await sleep(250 * attempt);
    }
  }

  const delivery: WebhookDeliveryStatus = {
    id: makeId("wh", `${run.id}_${callbackUrl}_${Date.now()}`),
    runId: run.id,
    callbackUrl,
    status: "failed",
    attempts: maxAttempts,
    deliveredAt: new Date().toISOString(),
    httpStatus: lastStatus,
    error: lastError?.message ?? "Webhook delivery failed.",
  };
  deliveryRuns.set(delivery.id, run);
  recordWebhookDelivery(delivery);
  recordObservabilityEvent({
    category: "webhook",
    status: "error",
    message: `Webhook failed for ${run.subject}.`,
    relatedId: delivery.id,
    metadata: {
      runId: run.id,
      callbackUrl,
      attempts: maxAttempts,
      httpStatus: lastStatus ?? null,
      error: delivery.error ?? null,
    },
  });

  throw Object.assign(lastError ?? new Error("Webhook delivery failed."), {
    delivery,
  });
}
