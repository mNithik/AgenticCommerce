import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { AnalystOutput, LLMProviderName } from "@/lib/types";
import type { AnalystInput, LLMProvider, SummaryInput } from "@/lib/llm/provider";
import { clamp, makeId, unique } from "@/lib/utils";

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
          "Extract the shortest product, vendor, or purchase subject from the question. Return plain text only.",
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
          "You are a venture diligence analyst. Return only valid JSON with keys recommendation, confidence, rationale, strengths, concerns, nextSteps. Each claim must include claimText, recordIds, and sourceUrls. Use only the provided record ids and URLs.",
      },
      {
        role: "user",
        content:
          `Question: ${input.question}\nSubject: ${input.subject}\n\nRecords:\n${body}`,
      },
    ]);

    const parsed = JSON.parse(cleanJson(output)) as AnalystOutput;

    const sanitizeClaim = (
      claim: AnalystOutput["rationale"] | AnalystOutput["strengths"][number],
      fallback: string,
    ) => ({
      id: claim.id || makeId("claim", fallback),
      claimText: claim.claimText || fallback,
      recordIds: unique(claim.recordIds ?? []).filter(Boolean),
      sourceUrls: unique(claim.sourceUrls ?? []).filter(Boolean),
    });

    return {
      recommendation:
        parsed.recommendation === "buy" ||
        parsed.recommendation === "do_not_buy" ||
        parsed.recommendation === "need_more_evidence"
          ? parsed.recommendation
          : "need_more_evidence",
      confidence: clamp(parsed.confidence ?? 0.5, 0, 1),
      rationale: sanitizeClaim(parsed.rationale, "Rationale unavailable."),
      strengths: (parsed.strengths ?? [])
        .slice(0, 3)
        .map((claim, index) => sanitizeClaim(claim, `Strength ${index + 1}`)),
      concerns: (parsed.concerns ?? [])
        .slice(0, 3)
        .map((claim, index) => sanitizeClaim(claim, `Concern ${index + 1}`)),
      nextSteps: (parsed.nextSteps ?? [])
        .slice(0, 3)
        .map((claim, index) => sanitizeClaim(claim, `Next step ${index + 1}`)),
    };
  }
}
