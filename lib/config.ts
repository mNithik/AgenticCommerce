import type { LLMProviderName, PaymentMode } from "./types";

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export const config = {
  mockX402: env("MOCK_X402") !== "false",
  tavilyX402Url: env("TAVILY_X402_URL") ?? "https://x402.tavily.com/search",
  agentWalletKey: env("AGENT_WALLET_KEY"),
  awalMaxAmount: env("AWAL_MAX_AMOUNT") ?? "20000",
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

  if (!config.agentWalletKey) {
    throw new Error(
      "Live mode requires AGENT_WALLET_KEY. Set MOCK_X402=true for local mock runs.",
    );
  }
}
