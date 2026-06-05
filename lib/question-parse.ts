import type { ConfidenceGapTheme } from "./types";

export type ValidationIntent =
  | "pricing"
  | "roi"
  | "implementation"
  | "legal_compliance"
  | "deliverability";

export type QuestionParse = {
  subject: string;
  spendSignal?: string;
  companyStage?: "early-stage" | "enterprise" | "smb";
  intents: ValidationIntent[];
  riskThemes: ConfidenceGapTheme[];
  spendSensitive: boolean;
};

const INTENT_PATTERNS: Array<{ intent: ValidationIntent; pattern: RegExp }> = [
  { intent: "pricing", pattern: /\b(pricing|contract|seat|fee|cost|budget)\b/i },
  { intent: "roi", pattern: /\b(roi|return|pipeline|revenue|payback|worth it)\b/i },
  { intent: "implementation", pattern: /\b(implementation|onboarding|setup|deployment|reference)\b/i },
  { intent: "legal_compliance", pattern: /\b(legal|lawsuit|privacy|compliance|gdpr|ccpa)\b/i },
  { intent: "deliverability", pattern: /\b(deliverability|bounce|email quality|data quality|accuracy)\b/i },
];

function extractSpendSignal(question: string) {
  const match = question.match(/\$\s?\d[\d,]*(?:\.\d+)?(?:\s*\/\s*(?:month|mo|year|yr))?/i);
  if (match) {
    return match[0].replace(/\s+/g, " ").trim();
  }

  const periodic = question.match(/\b\d[\d,]*(?:\.\d+)?\s+(?:per seat|per month|monthly|annually|per year)\b/i);
  return periodic?.[0]?.trim();
}

function extractCompanyStage(question: string): QuestionParse["companyStage"] {
  if (/\bearly[- ]stage\b/i.test(question)) {
    return "early-stage";
  }
  if (/\benterprise\b/i.test(question)) {
    return "enterprise";
  }
  if (/\bsmb\b|\bsmall business\b/i.test(question)) {
    return "smb";
  }
  return undefined;
}

function themeForIntent(intent: ValidationIntent): ConfidenceGapTheme {
  switch (intent) {
    case "pricing":
    case "roi":
      return "pricing_validation";
    case "implementation":
      return "implementation_validation";
    case "legal_compliance":
      return "legal_resolution";
    case "deliverability":
      return "deliverability_validation";
  }
}

export function parseQuestion(question: string, subject: string): QuestionParse {
  const intents = INTENT_PATTERNS.filter(({ pattern }) => pattern.test(question)).map(
    ({ intent }) => intent,
  );
  const uniqueIntents = Array.from(new Set(intents));
  const riskThemes = Array.from(new Set(uniqueIntents.map(themeForIntent)));

  return {
    subject,
    spendSignal: extractSpendSignal(question),
    companyStage: extractCompanyStage(question),
    intents: uniqueIntents,
    riskThemes,
    spendSensitive:
      /\b(should i spend|worth|buy|budget|pricing|contract|roi|return)\b/i.test(question) ||
      Boolean(extractSpendSignal(question)),
  };
}
