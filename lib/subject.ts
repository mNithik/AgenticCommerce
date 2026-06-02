import type { LLMProvider } from "@/lib/llm/provider";
import { deterministicProvider } from "@/lib/llm/deterministic";

export async function extractSubject(question: string, provider: LLMProvider) {
  const chosen = provider.isConfigured() ? provider : deterministicProvider;
  const subject = await chosen.extractSubject(question);
  return subject.trim() || deterministicProvider.extractSubject(question);
}
