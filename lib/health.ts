import { config, resolvePaymentMode, resolvePolicyProfile } from "./config";
import { getRateLimitSnapshot, getUptimeSeconds } from "./rate-limit";
import { ensureScheduleWorker } from "./schedules";
import type { HealthStatusResponse } from "./types";
import { getRecentWebhookDeliveries } from "./webhooks";
import { estimatePaidSearchCostUsd } from "./x402-search";

export function buildHealthStatus(): HealthStatusResponse {
  ensureScheduleWorker();
  const paymentMode = resolvePaymentMode();
  const walletConfigured = Boolean(config.agentWalletKey);
  const liveConfigured = paymentMode === "mock" ? false : walletConfigured;
  const searchReady = Boolean(config.tavilyX402Url);

  return {
    ok: true,
    app: "ProofSpend",
    paymentMode,
    policyProfile: resolvePolicyProfile(),
    llmProvider: config.llmProvider,
    mockX402: config.mockX402,
    liveConfigured,
    walletConfigured,
    searchReady,
    snapshotSigningAvailable: Boolean(config.proofSigningSecret),
    readinessSummary:
      paymentMode === "mock"
        ? "Mock fixtures and simulated receipts are ready."
        : walletConfigured
          ? "Live x402 wallet is configured for paid search."
          : "Live x402 requires a configured wallet.",
    estimatedPaidCallCostUsd: estimatePaidSearchCostUsd(),
    estimatedBaselineCalls: 3,
    estimatedMaxCalls: 4,
    uptimeSeconds: getUptimeSeconds(),
    rateLimits: getRateLimitSnapshot(),
    recentWebhookDeliveries: getRecentWebhookDeliveries(),
  };
}
