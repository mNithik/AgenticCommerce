import { config } from "@/lib/config";
import { deterministicProvider } from "@/lib/llm/deterministic";
import { huggingFaceProvider } from "@/lib/llm/huggingface";
import { nvidiaProvider } from "@/lib/llm/nvidia";
import { openaiProvider } from "@/lib/llm/openai";
import type { LLMProvider } from "@/lib/llm/provider";

const providers: Record<string, LLMProvider> = {
  nvidia: nvidiaProvider,
  openai: openaiProvider,
  huggingface: huggingFaceProvider,
  deterministic: deterministicProvider,
};

export function getLLMProvider() {
  const preferred = providers[config.llmProvider];
  if (preferred?.isConfigured()) {
    return preferred;
  }

  return deterministicProvider;
}
