import type { LLMProviderName, PaymentMode } from "@/lib/types";

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export const config = {
  mockX402: env("MOCK_X402") !== "false",
  tavilyX402Url: env("TAVILY_X402_URL") ?? "https://x402.tavily.com/search",
  agentWalletKey: env("AGENT_WALLET_KEY"),
  awalMaxAmount: env("AWAL_MAX_AMOUNT") ?? "20000",
  // Hard ceiling on paid searches per run (3 agents x 2 queries + Skeptic x 2 = 8).
  maxPaidCalls: Number(env("MAX_PAID_CALLS") ?? "10"),
  llmProvider: (env("LLM_PROVIDER") ?? "nvidia") as LLMProviderName,
  nvidiaApiKey: env("NVIDIA_API_KEY"),
  nvidiaBaseUrl: env("NVIDIA_BASE_URL") ?? "https://integrate.api.nvidia.com/v1",
  nvidiaModelSummary:
    env("NVIDIA_MODEL_SUMMARY") ?? "meta/llama-3.1-70b-instruct",
  nvidiaModelAnalyst:
    env("NVIDIA_MODEL_ANALYST") ?? "meta/llama-3.1-70b-instruct",
  openaiApiKey: env("OPENAI_API_KEY"),
  openaiModelSummary: env("OPENAI_MODEL_SUMMARY") ?? "gpt-4o-mini",
  openaiModelAnalyst: env("OPENAI_MODEL_ANALYST") ?? "gpt-4o-mini",
  hfToken: env("HF_TOKEN"),
  hfBaseUrl: env("HF_BASE_URL") ?? "https://router.huggingface.co/v1",
  hfModelSummary:
    env("HF_MODEL_SUMMARY") ?? "meta-llama/Llama-3.1-70B-Instruct",
  hfModelAnalyst:
    env("HF_MODEL_ANALYST") ?? "meta-llama/Llama-3.1-70B-Instruct",
};

export function resolvePaymentMode(): PaymentMode {
  return config.mockX402 ? "mock" : "live";
}

export function assertLiveModeConfigured() {
  if (config.mockX402) {
    return;
  }

  // Live payments are signed by the authenticated `awal` CLI session
  // (`npx awal auth login/verify`), which manages the wallet itself — there is
  // no raw private key to provide. AGENT_WALLET_KEY is therefore optional.
  // If awal is not signed in, `npx awal x402 pay` will surface its own error
  // at call time, which we propagate as a run_error.
}
