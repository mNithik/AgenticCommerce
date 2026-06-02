import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { deterministicProvider } from "./deterministic";
import type { AnalystOutput, LLMProviderName } from "../types";
import type { AnalystInput, LLMProvider, SummaryInput } from "./provider";
import { clamp, makeId, unique } from "../utils";
import type { AgentName, MemoClaim, Recommendation } from "../types";

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

function sourceCatalog(input: AnalystInput) {
  const validRecordIds = new Set(input.records.map((record) => record.id));
  const validSourceUrls = new Set(
    input.records.flatMap((record) => record.sources.map((source) => source.url)),
  );
  const recordsByAgent = new Map<AgentName, AnalystInput["records"][number][]>();

  for (const record of input.records) {
    const current = recordsByAgent.get(record.agent) ?? [];
    current.push(record);
    recordsByAgent.set(record.agent, current);
  }

  return { validRecordIds, validSourceUrls, recordsByAgent };
}

function filterClaimToCatalog(
  claim: MemoClaim,
  catalog: ReturnType<typeof sourceCatalog>,
  fallbackClaim?: MemoClaim,
) {
  const recordIds = unique(
    claim.recordIds.filter((recordId) => catalog.validRecordIds.has(recordId)),
  );
  const fallbackRecordIds = unique(
    (fallbackClaim?.recordIds ?? []).filter((recordId) => catalog.validRecordIds.has(recordId)),
  );
  const sourceUrls = unique(
    claim.sourceUrls.filter((url) => catalog.validSourceUrls.has(url)),
  );
  const fallbackSourceUrls = unique(
    (fallbackClaim?.sourceUrls ?? []).filter((url) => catalog.validSourceUrls.has(url)),
  );

  return {
    ...claim,
    recordIds: recordIds.length ? recordIds : fallbackRecordIds,
    sourceUrls: sourceUrls.length ? sourceUrls : fallbackSourceUrls,
  };
}

function isPlaceholderClaim(claim: MemoClaim | undefined, kind: "strength" | "concern" | "nextStep") {
  if (!claim) {
    return true;
  }

  const pattern =
    kind === "strength"
      ? /^Strength \d+$/i
      : kind === "concern"
        ? /^Concern \d+$/i
        : /^Next step \d+$/i;
  return !claim.claimText.trim() || pattern.test(claim.claimText.trim());
}

function buildFallbackClaimFromRecord(
  input: AnalystInput,
  recordId: string | undefined,
  label: string,
) {
  const record = input.records.find((item) => item.id === recordId);
  if (!record) {
    return undefined;
  }

  return {
    id: makeId("claim", `${record.id}_${label}`),
    claimText: record.finding,
    recordIds: [record.id],
    sourceUrls: unique(record.sources.slice(0, 2).map((source) => source.url)),
  };
}

function inferRecommendation(
  current: Recommendation,
  confidence: number,
  strengths: MemoClaim[],
  concerns: MemoClaim[],
) {
  if (concerns.length >= strengths.length && concerns.length > 0) {
    return confidence >= 0.65 ? "do_not_buy" : "need_more_evidence";
  }

  if (concerns.length > 0 && current === "buy" && confidence < 0.85) {
    return "need_more_evidence";
  }

  if (strengths.length > concerns.length + 1 && confidence >= 0.7) {
    return "buy";
  }

  return current;
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

    const catalog = sourceCatalog(input);
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

    const strengthClaims = (parsed.strengths ?? [])
      .slice(0, 3)
      .map((claim, index) =>
        sanitizeClaimWithFallback(
          claim,
          fallbackOutput?.strengths[index],
          fallbackOutput?.strengths[index]?.claimText ?? `Strength ${index + 1}`,
        ),
      )
      .map((claim, index) =>
        filterClaimToCatalog(
          claim,
          catalog,
          fallbackOutput?.strengths[index],
        ),
      )
      .filter((claim) => !isPlaceholderClaim(claim, "strength"));

    const concernClaims = (parsed.concerns?.length ? parsed.concerns : fallbackOutput?.concerns ?? [])
      .slice(0, 3)
      .map((claim, index) =>
        sanitizeClaimWithFallback(
          claim,
          fallbackOutput?.concerns[index],
          fallbackOutput?.concerns[index]?.claimText ?? `Concern ${index + 1}`,
        ),
      )
      .map((claim, index) =>
        filterClaimToCatalog(
          claim,
          catalog,
          fallbackOutput?.concerns[index],
        ),
      )
      .filter((claim) => !isPlaceholderClaim(claim, "concern"));

    const nextStepClaims = (parsed.nextSteps?.length ? parsed.nextSteps : fallbackOutput?.nextSteps ?? [])
      .slice(0, 3)
      .map((claim, index) =>
        sanitizeClaimWithFallback(
          claim,
          fallbackOutput?.nextSteps[index],
          fallbackOutput?.nextSteps[index]?.claimText ?? `Next step ${index + 1}`,
        ),
      )
      .map((claim, index) =>
        filterClaimToCatalog(
          claim,
          catalog,
          fallbackOutput?.nextSteps[index],
        ),
      )
      .filter((claim) => !isPlaceholderClaim(claim, "nextStep"));

    const sanitizedRationale = filterClaimToCatalog(
      sanitizeClaimWithFallback(
        typeof parsed.rationale === "object" ? parsed.rationale : undefined,
        fallbackOutput?.rationale,
        fallbackOutput?.rationale.claimText ?? fallbackRationaleText,
      ),
      catalog,
      fallbackOutput?.rationale,
    );

    const repairedStrengths =
      strengthClaims.length > 0
        ? strengthClaims
        : input.records
            .filter((record) => record.agent === "Market" || record.agent === "Evidence")
            .slice(0, 2)
            .map((record, index) =>
              buildFallbackClaimFromRecord(input, record.id, `strength_${index}`),
            )
            .filter(Boolean) as MemoClaim[];

    const repairedConcerns =
      concernClaims.length > 0
        ? concernClaims
        : input.records
            .filter((record) => record.agent === "Counter" || record.agent === "Skeptic")
            .slice(0, 2)
            .map((record, index) =>
              buildFallbackClaimFromRecord(input, record.id, `concern_${index}`),
            )
            .filter(Boolean) as MemoClaim[];

    const repairedNextSteps =
      nextStepClaims.length > 0
        ? nextStepClaims
        : (fallbackOutput?.nextSteps ?? []).map((claim) =>
            filterClaimToCatalog(claim, catalog, fallbackOutput?.nextSteps[0]),
          );

    const baseRecommendation =
      parsed.recommendation === "buy" ||
      parsed.recommendation === "do_not_buy" ||
      parsed.recommendation === "need_more_evidence"
        ? parsed.recommendation
        : (fallbackOutput?.recommendation ?? "need_more_evidence");
    const confidence = clamp(parsed.confidence ?? fallbackOutput?.confidence ?? 0.5, 0, 1);

    return {
      recommendation: inferRecommendation(
        baseRecommendation,
        confidence,
        repairedStrengths,
        repairedConcerns,
      ),
      confidence,
      rationale: sanitizedRationale,
      strengths: repairedStrengths,
      concerns: repairedConcerns,
      nextSteps: repairedNextSteps,
    };
  }
}
