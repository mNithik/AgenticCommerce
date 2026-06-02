import type { LLMProvider } from "./llm/provider";
import { deterministicProvider } from "./llm/deterministic";

function sanitizeSubject(candidate: string) {
  return candidate
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/^should i (buy|spend on|purchase)\s+/i, "")
    .replace(/\b(for|with|because|if|whether)\b[\s\S]*$/i, "")
    .trim();
}

function looksTooGeneric(candidate: string) {
  const lower = candidate.toLowerCase();
  return (
    !candidate ||
    candidate.length < 3 ||
    [
      "purchase",
      "vendor",
      "tool",
      "software",
      "service",
      "subscription",
      "product",
      "solution",
      "platform",
    ].includes(lower)
  );
}

export async function extractSubject(question: string, provider: LLMProvider) {
  const chosen = provider.isConfigured() ? provider : deterministicProvider;
  const subject = sanitizeSubject(await chosen.extractSubject(question));

  if (!looksTooGeneric(subject)) {
    return subject;
  }

  return sanitizeSubject(await deterministicProvider.extractSubject(question));
}
