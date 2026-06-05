import { runDiligence } from "./orchestrator";
import { recordObservabilityEvent } from "./observability";
import { addRecentRun } from "./recent-runs";
import type {
  DiligenceRun,
  PolicyProfile,
  RunEvent,
  WebhookDeliveryStatus,
} from "./types";
import { deliverRunWebhook } from "./webhooks";

type ExecuteRunOptions = {
  question: string;
  budgetCapUsd: number;
  policyProfile?: PolicyProfile;
  callbackUrl?: string;
  parentRunId?: string;
  parentRun?: DiligenceRun;
  gapId?: string;
  suggestedQuery?: string;
  emit?: (event: RunEvent) => void;
};

export async function executeRun({
  question,
  budgetCapUsd,
  policyProfile,
  callbackUrl,
  parentRunId,
  parentRun,
  gapId,
  suggestedQuery,
  emit,
}: ExecuteRunOptions): Promise<DiligenceRun> {
  recordObservabilityEvent({
    category: "run",
    status: "info",
    message: `Run requested for "${question.slice(0, 48)}".`,
    metadata: {
      budgetCapUsd,
      policyProfile: policyProfile ?? "standard",
      callback: Boolean(callbackUrl),
      parentRunId: parentRunId ?? null,
      gapId: gapId ?? null,
    },
  });

  let run: DiligenceRun;
  try {
    run = await runDiligence({
      question,
      budgetCapUsd,
      policyProfile,
      parentRunId,
      parentRun,
      gapId,
      suggestedQuery,
      emit: emit ?? (() => undefined),
    });
  } catch (error) {
    recordObservabilityEvent({
      category: "run",
      status: "error",
      message: `Run failed for "${question.slice(0, 48)}".`,
      metadata: {
        error: error instanceof Error ? error.message : "Unknown run failure.",
      },
    });
    throw error;
  }

  let finalRun: DiligenceRun = run;

  if (callbackUrl) {
    try {
      const delivery = await deliverRunWebhook(callbackUrl, run);
      finalRun = {
        ...run,
        webhookDelivery: delivery,
      };
      emit?.({
        type: "webhook_delivery",
        delivery,
      });
    } catch (error) {
      const delivery = (error as { delivery?: WebhookDeliveryStatus }).delivery;
      if (delivery) {
        finalRun = {
          ...run,
          webhookDelivery: delivery,
        };
        emit?.({
          type: "webhook_delivery",
          delivery,
        });
      } else {
        emit?.({
          type: "run_error",
          message:
            error instanceof Error
              ? `Callback delivery failed: ${error.message}`
              : "Callback delivery failed.",
        });
      }
    }
  }

  addRecentRun(finalRun);
  recordObservabilityEvent({
    category: "run",
    status: "success",
    message: `Run completed for ${finalRun.subject}.`,
    relatedId: finalRun.id,
    metadata: {
      paidCalls: finalRun.paidCalls,
      spentUsd: finalRun.spentUsd,
      recommendation: finalRun.recommendation,
    },
  });
  return finalRun;
}
