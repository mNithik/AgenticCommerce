import type { AnalystInput, FindingResult, LLMProvider, SummaryInput } from "@/lib/llm/provider";
import type { AnalystOutput, FindingClaim } from "@/lib/types";
import { clamp, makeId, unique } from "@/lib/utils";

function pickSentence(text: string, fallback: string) {
  return text.split(/(?<=[.!?])\s+/)[0]?.trim() || fallback;
}

function keywordScore(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  const hits = keywords.filter((keyword) => lower.includes(keyword)).length;
  return clamp(0.25 + hits * 0.18, 0, 1);
}

export const deterministicProvider: LLMProvider = {
  name: "deterministic",
  isConfigured: () => true,
  async extractSubject(question) {
    const cleaned = question
      .replace(/^should i buy\s+/i, "")
      .replace(/^is\s+/i, "")
      .replace(/\?+$/g, "")
      .trim();

    if (!cleaned) {
      return "the purchase";
    }

    const pieces = cleaned.split(/(?: for | from | with | about )/i);
    return pieces[0].trim();
  },
  async summarizeFinding(input: SummaryInput): Promise<FindingResult> {
    const topSources = input.sources.slice(0, 2);
    const posture =
      input.agent === "Counter" || input.agent === "Skeptic" ? "Risk noted" : "Support found";

    const claims: FindingClaim[] = topSources.map((source) => ({
      claimText: `${posture}: ${source.title} — ${pickSentence(source.snippet, source.snippet)}`,
      sourceUrls: source.url ? [source.url] : [],
    }));

    if (claims.length === 0) {
      claims.push({
        claimText: `No sources available for ${input.agent.toLowerCase()} research on ${input.subject}.`,
        sourceUrls: [],
      });
    }

    return { text: claims.map((claim) => claim.claimText).join(" "), claims };
  },
  async scoreConfidence(text) {
    return keywordScore(text, ["growing", "strong", "adoption", "demand", "trusted"]);
  },
  async scoreNegativity(text) {
    return keywordScore(text, ["lawsuit", "complaint", "scam", "risk", "failure"]);
  },
  async synthesizeAnalystOutput(input: AnalystInput): Promise<AnalystOutput> {
    const strengths = input.records
      .filter((record) => record.agent === "Market" || record.agent === "Evidence")
      .slice(0, 2)
      .map((record, index) => ({
        id: makeId("claim", `${record.id}_strength_${index}`),
        claimText: pickSentence(record.finding, "Positive evidence is limited."),
        recordIds: [record.id],
        sourceUrls: unique(record.sources.slice(0, 2).map((source) => source.url)),
      }));

    const concerns = input.records
      .filter((record) => record.agent === "Counter" || record.agent === "Skeptic")
      .slice(0, 2)
      .map((record, index) => ({
        id: makeId("claim", `${record.id}_concern_${index}`),
        claimText: pickSentence(record.finding, "Risk evidence is limited."),
        recordIds: [record.id],
        sourceUrls: unique(record.sources.slice(0, 2).map((source) => source.url)),
      }));

    const positiveSignals = strengths.length;
    const negativeSignals = concerns.length;
    const recommendation =
      negativeSignals > positiveSignals
        ? "do_not_buy"
        : positiveSignals === 0
          ? "need_more_evidence"
          : "buy";
    const confidence = clamp(0.45 + positiveSignals * 0.12 - negativeSignals * 0.08, 0.2, 0.85);

    return {
      recommendation,
      confidence,
      rationale: {
        id: makeId("claim", `${input.subject}_rationale`),
        claimText:
          recommendation === "buy"
            ? `The available evidence leans positive for ${input.subject}, though the recommendation stays bounded by the limited paid search scope.`
            : recommendation === "do_not_buy"
              ? `The negative evidence currently outweighs the upside signals for ${input.subject}.`
              : `The evidence on ${input.subject} is mixed, so more diligence is needed before a strong recommendation.`,
        recordIds: unique(input.records.slice(0, 3).map((record) => record.id)),
        sourceUrls: unique(
          input.records.flatMap((record) => record.sources.slice(0, 1).map((source) => source.url)),
        ),
      },
      strengths,
      concerns,
      nextSteps: [
        {
          id: makeId("claim", `${input.subject}_next_1`),
          claimText: "Validate pricing, contract terms, and implementation references before spending beyond the current research cap.",
          recordIds: unique(input.records.slice(0, 2).map((record) => record.id)),
          sourceUrls: unique(
            input.records.slice(0, 2).flatMap((record) => record.sources.slice(0, 1).map((source) => source.url)),
          ),
        },
      ],
    };
  },
};
