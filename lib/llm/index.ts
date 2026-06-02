import { config } from "../config";
import { deterministicProvider } from "./deterministic";
import { huggingFaceProvider } from "./huggingface";
import { nvidiaProvider } from "./nvidia";
import { openaiProvider } from "./openai";
import type { LLMProvider } from "./provider";

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
