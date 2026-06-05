import type { AgentName, ConfidenceGap, DiligenceBrief } from "./types";
import type { QuestionParse } from "./question-parse";
import { sanitizeGapQuery } from "./gap-query-sanitize";

function join(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function competitiveQuery(brief: DiligenceBrief) {
  return join([
    brief.subject,
    "vs Cursor vs Codeium pricing comparison developer tools 2026",
    brief.useCaseContext,
  ]);
}

function fitQuery(brief: DiligenceBrief) {
  return join([
    brief.subject,
    brief.useCaseContext,
    "TypeScript React developer productivity implementation",
  ]);
}

function legalQuery(brief: DiligenceBrief) {
  return join([
    brief.subject,
    "copyright lawsuit training data privacy complaints compliance",
  ]);
}

export function buildResearchQuery(
  brief: DiligenceBrief,
  parsed: QuestionParse,
  agent: AgentName,
) {
  const spend = brief.spendSignal ?? parsed.spendSignal;
  switch (agent) {
    case "Market":
      if (brief.requestedSections.includes("competitive")) {
        return competitiveQuery(brief);
      }
      return join([brief.subject, spend, "pricing category competitors seat economics", brief.useCaseContext]);
    case "Evidence":
      return join([
        brief.subject,
        brief.useCaseContext,
        brief.requestedSections.includes("fit") ? "developer fit" : undefined,
        "ROI case study implementation references",
      ]);
    case "Counter":
      return legalQuery(brief);
    case "Skeptic":
      return join([brief.subject, brief.useCaseContext, "risks hidden fees failed deployments negative press"]);
  }
}

export function buildFollowUpQuery(
  brief: DiligenceBrief,
  parsed: QuestionParse,
  gap: ConfidenceGap,
) {
  const sanitized = sanitizeGapQuery(brief, gap);
  if (sanitized) {
    return sanitized;
  }

  if (gap.theme === "pricing_validation" || brief.requestedSections.includes("competitive")) {
    return competitiveQuery(brief);
  }
  if (gap.theme === "implementation_validation" || brief.requestedSections.includes("fit")) {
    return fitQuery(brief);
  }
  if (gap.theme === "legal_resolution" || brief.requestedSections.includes("legal")) {
    return legalQuery(brief);
  }

  return buildResearchQuery(brief, parsed, gap.focusAgent ?? "Evidence");
}
