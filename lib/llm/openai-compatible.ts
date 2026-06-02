import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { deterministicProvider } from "./deterministic";
import type { AnalystOutput, LLMProviderName } from "../types";
import type { AnalystInput, LLMProvider, SummaryInput } from "./provider";
import { clamp, makeId, unique } from "../utils";

type Options = {
  name: LLMProviderName;
  apiKey?: string;
  baseURL?: string;
  summaryModel: string;
  analystModel: string;
};

function cleanJson(value: string) {
  return value.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

function extractJsonObject(value: string) {
  const cleaned = cleanJson(value);
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function heuristicScore(text: string, positive: string[], negative: string[]) {
  const lower = text.toLowerCase();
  let score = 0.5;

  for (const token of positive) {
    if (lower.includes(token)) {
      score += 0.1;
    }
  }

  for (const token of negative) {
    if (lower.includes(token)) {
      score -= 0.1;
    }
  }

  return clamp(score, 0, 1);
}

function hasUsableClaim(
  claim:
    | Partial<AnalystOutput["rationale"]>
    | Partial<AnalystOutput["strengths"][number]>
    | undefined,
) {
  const text = claim?.claimText?.trim();
  return Boolean(
    text &&
      text !== "Rationale unavailable." &&
      !/^Strength \d+$/i.test(text) &&
      !/^Concern \d+$/i.test(text) &&
      !/^Next step \d+$/i.test(text),
  );
}

function sanitizeClaimWithFallback(
  claim:
    | Partial<AnalystOutput["rationale"]>
    | Partial<AnalystOutput["strengths"][number]>
    | undefined,
  fallbackClaim:
    | Partial<AnalystOutput["rationale"]>
    | Partial<AnalystOutput["strengths"][number]>
    | undefined,
  fallbackText: string,
) {
  const resolved = hasUsableClaim(claim) ? claim : fallbackClaim;

  return {
    id: resolved?.id || makeId("claim", fallbackText),
    claimText: resolved?.claimText || fallbackText,
    recordIds: unique(resolved?.recordIds ?? fallbackClaim?.recordIds ?? []).filter(Boolean),
    sourceUrls: unique(resolved?.sourceUrls ?? fallbackClaim?.sourceUrls ?? []).filter(Boolean),
  };
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: LLMProviderName;
  private readonly client?: OpenAI;
  private readonly summaryModel: string;
  private readonly analystModel: string;

  constructor(options: Options) {
    this.name = options.name;
    this.summaryModel = options.summaryModel;
    this.analystModel = options.analystModel;
    this.client = options.apiKey
      ? new OpenAI({
          apiKey: options.apiKey,
          baseURL: options.baseURL,
        })
      : undefined;
  }

  isConfigured() {
    return Boolean(this.client);
  }

  private async complete(model: string, messages: ChatCompletionMessageParam[]) {
    if (!this.client) {
      throw new Error(`${this.name} is not configured.`);
    }

    const result = await this.client.chat.completions.create({
      model,
      temperature: 0.2,
      messages,
    });

    return result.choices[0]?.message?.content?.trim() ?? "";
  }

  async extractSubject(question: string) {
    const output = await this.complete(this.summaryModel, [
      {
        role: "system",
        content:
          "Extract the specific product, company, or vendor being evaluated. Prefer branded names like Apollo.io, Ramp, HubSpot, or Notion over generic words like purchase or vendor. Return plain text only.",
      },
      {
        role: "user",
        content: question,
      },
    ]);

    return output.replace(/^"+|"+$/g, "").trim() || question.trim();
  }

  async summarizeFinding(input: SummaryInput) {
    const sources = input.sources
      .map(
        (source, index) =>
          `${index + 1}. ${source.title}\nURL: ${source.url}\nSnippet: ${source.snippet}`,
      )
      .join("\n\n");

    return this.complete(this.summaryModel, [
      {
        role: "system",
        content:
          "Write a concise evidence summary using only the provided sources. Mention concrete positives and negatives when present. Keep it to 2-3 sentences.",
      },
      {
        role: "user",
        content:
          `Agent: ${input.agent}\nSubject: ${input.subject}\nQuery: ${input.query}\n\nSources:\n${sources}`,
      },
    ]);
  }

  async scoreConfidence(text: string) {
    const output = await this.complete(this.summaryModel, [
      {
        role: "system",
        content:
          "Score how confident and commercially promising this finding sounds on a 0 to 1 scale. Return JSON: {\"score\": number}.",
      },
      {
        role: "user",
        content: text,
      },
    ]);

    try {
      const parsed = JSON.parse(cleanJson(output)) as { score?: number };
      return clamp(parsed.score ?? 0.5, 0, 1);
    } catch {
      return heuristicScore(text, ["strong", "clear", "growing", "validated"], [
        "weak",
        "uncertain",
        "mixed",
        "risk",
      ]);
    }
  }

  async scoreNegativity(text: string) {
    const output = await this.complete(this.summaryModel, [
      {
        role: "system",
        content:
          "Score how negative or risky this finding is on a 0 to 1 scale. Return JSON: {\"score\": number}.",
      },
      {
        role: "user",
        content: text,
      },
    ]);

    try {
      const parsed = JSON.parse(cleanJson(output)) as { score?: number };
      return clamp(parsed.score ?? 0.5, 0, 1);
    } catch {
      return heuristicScore(text, ["lawsuit", "complaint", "scam", "risk"], [
        "strong",
        "good",
        "trusted",
      ]);
    }
  }

  async synthesizeAnalystOutput(input: AnalystInput) {
    const body = input.records
      .map((record) => {
        const urls = record.sources.map((source) => source.url);
        return JSON.stringify({
          id: record.id,
          agent: record.agent,
          finding: record.finding,
          sourceUrls: urls,
        });
      })
      .join("\n");

    const output = await this.complete(this.analystModel, [
      {
        role: "system",
        content:
          "You are a venture diligence analyst. Return only valid JSON with keys recommendation, confidence, rationale, strengths, concerns, nextSteps. The rationale must be an object, not a string. Each claim object must include claimText, recordIds, and sourceUrls. Use only the provided record ids and URLs.",
      },
      {
        role: "user",
        content:
          `Question: ${input.question}\nSubject: ${input.subject}\n\nRecords:\n${body}`,
      },
    ]);

    let parsed: Partial<AnalystOutput>;

    try {
      parsed = JSON.parse(extractJsonObject(output)) as AnalystOutput;
    } catch {
      parsed = {};
    }

    const fallbackRationaleText =
      typeof parsed.rationale === "string"
        ? parsed.rationale
        : parsed.strengths?.[0]?.claimText ||
          parsed.concerns?.[0]?.claimText ||
          "Rationale unavailable.";

    const fallbackOutput =
      !hasUsableClaim(
        typeof parsed.rationale === "object" ? parsed.rationale : undefined,
      ) ||
      !Array.isArray(parsed.strengths) ||
      parsed.strengths.length === 0 ||
      !Array.isArray(parsed.concerns) ||
      parsed.concerns.length === 0 ||
      !Array.isArray(parsed.nextSteps) ||
      parsed.nextSteps.length === 0
        ? await deterministicProvider.synthesizeAnalystOutput(input)
        : undefined;

    return {
      recommendation:
        parsed.recommendation === "buy" ||
        parsed.recommendation === "do_not_buy" ||
        parsed.recommendation === "need_more_evidence"
          ? parsed.recommendation
          : (fallbackOutput?.recommendation ?? "need_more_evidence"),
      confidence: clamp(parsed.confidence ?? fallbackOutput?.confidence ?? 0.5, 0, 1),
      rationale: sanitizeClaimWithFallback(
        typeof parsed.rationale === "object" ? parsed.rationale : undefined,
        fallbackOutput?.rationale,
        fallbackOutput?.rationale.claimText ?? fallbackRationaleText,
      ),
      strengths:
        (parsed.strengths?.length ? parsed.strengths : fallbackOutput?.strengths ?? [])
          .slice(0, 3)
          .map((claim, index) =>
            sanitizeClaimWithFallback(
              claim,
              fallbackOutput?.strengths[index],
              fallbackOutput?.strengths[index]?.claimText ?? `Strength ${index + 1}`,
            ),
          ),
      concerns:
        (parsed.concerns?.length ? parsed.concerns : fallbackOutput?.concerns ?? [])
          .slice(0, 3)
          .map((claim, index) =>
            sanitizeClaimWithFallback(
              claim,
              fallbackOutput?.concerns[index],
              fallbackOutput?.concerns[index]?.claimText ?? `Concern ${index + 1}`,
            ),
          ),
      nextSteps:
        (parsed.nextSteps?.length ? parsed.nextSteps : fallbackOutput?.nextSteps ?? [])
          .slice(0, 3)
          .map((claim, index) =>
            sanitizeClaimWithFallback(
              claim,
              fallbackOutput?.nextSteps[index],
              fallbackOutput?.nextSteps[index]?.claimText ?? `Next step ${index + 1}`,
            ),
          ),
    };
  }
}
