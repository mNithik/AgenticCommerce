import type {
  ConfidenceGap,
  ConfidenceGapTheme,
  EvidenceRecord,
} from "./types";
import type { QuestionParse } from "./question-parse";
import { buildGapQuery } from "./query-builder";
import { normalizeQuery } from "./text-utils";

export type FollowUpSelectionInput = {
  records: EvidenceRecord[];
  gaps: ConfidenceGap[];
  parsedQuestion: QuestionParse;
  remainingBudget: number;
  remainingPaidCallSlots: number;
  estimatedPaidCallCostUsd: number;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "status",
  "validation",
  "check",
]);

function themeRank(theme?: ConfidenceGapTheme) {
  switch (theme) {
    case "legal_resolution":
      return 5;
    case "pricing_validation":
      return 4;
    case "implementation_validation":
      return 3;
    case "deliverability_validation":
      return 2;
    default:
      return 1;
  }
}

function tokenize(query: string) {
  return normalizeQuery(query)
    .split(" ")
    .filter((token) => token && !STOP_WORDS.has(token));
}

function overlap(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  }

  return shared / Math.max(leftTokens.size, rightTokens.size);
}

function isNearDuplicate(query: string, other: string) {
  return overlap(query, other) >= 0.8;
}

function enrichGap(gap: ConfidenceGap, parsedQuestion: QuestionParse) {
  const suggestedQuery = buildGapQuery(parsedQuestion, gap);
  return {
    ...gap,
    suggestedQuery,
  };
}

export function selectFollowUps(input: FollowUpSelectionInput): ConfidenceGap[] {
  const maxFollowUps = Math.min(2, input.remainingPaidCallSlots);
  if (maxFollowUps <= 0 || input.remainingBudget < input.estimatedPaidCallCostUsd) {
    return [];
  }

  const usedQueries = new Set(input.records.map((record) => normalizeQuery(record.query)));
  const selectedQueries: string[] = [];
  let counterLegalCount = 0;

  const candidates = input.gaps
    .filter((gap) => gap.actionType === "paid_search")
    .map((gap) => enrichGap(gap, input.parsedQuestion))
    .filter((gap) => gap.suggestedQuery)
    .sort((left, right) => {
      const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      const themeDelta = themeRank(right.theme) - themeRank(left.theme);
      if (themeDelta !== 0) {
        return themeDelta;
      }
      return right.estimatedConfidenceGain - left.estimatedConfidenceGain;
    });

  const selected: ConfidenceGap[] = [];

  for (const gap of candidates) {
    if (selected.length >= maxFollowUps) {
      break;
    }

    const query = normalizeQuery(gap.suggestedQuery ?? "");
    if (!query || usedQueries.has(query) || selectedQueries.some((item) => isNearDuplicate(query, item))) {
      continue;
    }

    const isCounterLegal = gap.focusAgent === "Counter" && gap.theme === "legal_resolution";
    if (isCounterLegal && counterLegalCount >= 1) {
      continue;
    }

    if (
      selected.length === 1 &&
      counterLegalCount >= 1 &&
      gap.focusAgent === "Counter" &&
      gap.theme === "legal_resolution"
    ) {
      continue;
    }

    if (
      selected.length === 1 &&
      counterLegalCount >= 1 &&
      gap.focusAgent === "Counter" &&
      candidates.some(
        (candidate) =>
          candidate.actionType === "paid_search" &&
          candidate.focusAgent !== "Counter" &&
          candidate.suggestedQuery &&
          !selected.some((item) => item.id === candidate.id),
      )
    ) {
      continue;
    }

    selected.push(gap);
    selectedQueries.push(query);
    if (isCounterLegal) {
      counterLegalCount += 1;
    }
  }

  return selected;
}
