import { config, resolvePaymentMode, resolvePolicyProfile } from "./config";
import { getRateLimitSnapshot, getUptimeSeconds } from "./rate-limit";
import { ensureScheduleWorker } from "./schedules";
import type { HealthStatusResponse } from "./types";
import { getRecentWebhookDeliveries } from "./webhooks";
import { estimatePaidSearchCostUsd } from "./x402-search";

export function buildHealthStatus(): HealthStatusResponse {
  ensureScheduleWorker();
  const paymentMode = resolvePaymentMode();
  const policyProfile = resolvePolicyProfile();
  const walletConfigured = Boolean(config.agentWalletKey);
  const liveConfigured = paymentMode === "mock" ? false : walletConfigured;
  const searchReady = Boolean(config.tavilyX402Url);
  const estimatedConfidenceRange =
    policyProfile === "strict"
      ? {
          baselineMin: 0.22,
          baselineMax: 0.34,
          upperBoundWithSkeptic: 0.44,
        }
      : {
          baselineMin: 0.24,
          baselineMax: 0.38,
          upperBoundWithSkeptic: 0.5,
        };

  return {
    ok: true,
    app: "ProofSpend",
    paymentMode,
    policyProfile,
    llmProvider: config.llmProvider,
    mockX402: config.mockX402,
    liveConfigured,
    walletConfigured,
    searchReady,
    snapshotSigningAvailable: Boolean(config.proofSigningSecret),
    apiAuthRequired: Boolean(config.apiAuthKey),
    readinessSummary:
      paymentMode === "mock"
        ? "Mock fixtures and simulated receipts are ready."
        : walletConfigured
          ? "Live x402 wallet is configured for paid search."
          : "Live x402 requires a configured wallet.",
    estimatedPaidCallCostUsd: estimatePaidSearchCostUsd(),
    estimatedBaselineCalls: 3,
    estimatedMaxCalls: policyProfile === "strict" ? 5 : 6,
    estimatedConfidenceRange,
    uptimeSeconds: getUptimeSeconds(),
    rateLimits: getRateLimitSnapshot(),
    recentWebhookDeliveries: getRecentWebhookDeliveries(),
  };
}
