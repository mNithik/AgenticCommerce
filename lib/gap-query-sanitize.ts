import type { ConfidenceGap } from "./types";
import type { DiligenceBrief } from "./types";

const UNSAFE_PATTERNS = [
  /unfortunately/i,
  /i don't have/i,
  /no sources/i,
  /i apologize/i,
  /unable to/i,
];

export function isUnsearchableText(text: string) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 30) {
    return true;
  }
  return UNSAFE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function defaultValidationQuery(brief: DiligenceBrief, gap: ConfidenceGap) {
  const context = brief.useCaseContext ? ` ${brief.useCaseContext}` : "";
  switch (gap.theme) {
    case "legal_resolution":
      return `${brief.subject} copyright lawsuit privacy compliance resolution${context}`;
    case "pricing_validation":
      return `${brief.subject} pricing contract terms ROI${context}`;
    case "implementation_validation":
      return `${brief.subject} implementation references developer workflow${context}`;
    case "deliverability_validation":
      return `${brief.subject} performance reliability developer complaints${context}`;
    default:
      return `${brief.subject} competitive fit pricing developer workflow${context}`;
  }
}

export function sanitizeGapQuery(brief: DiligenceBrief, gap: ConfidenceGap): string | null {
  if (gap.suggestedQuery && !isUnsearchableText(gap.suggestedQuery)) {
    return gap.suggestedQuery.trim();
  }

  if (gap.actionType !== "paid_search") {
    return null;
  }

  return defaultValidationQuery(brief, gap);
}
