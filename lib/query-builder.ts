import type { AgentName, ConfidenceGap, DiligenceBrief } from "./types";
import type { QuestionParse } from "./question-parse";
import { buildFollowUpQuery, buildResearchQuery } from "./research-plan";

export function buildAgentQuery(
  parsed: QuestionParse,
  agent: AgentName,
  brief?: DiligenceBrief,
) {
  if (brief) {
    return buildResearchQuery(brief, parsed, agent);
  }
  return buildResearchQuery(
    {
      rawQuestion: parsed.subject,
      subject: parsed.subject,
      spendSignal: parsed.spendSignal,
      companyStage: parsed.companyStage,
      requestedSections: [],
    },
    parsed,
    agent,
  );
}

export function buildGapQuery(
  parsed: QuestionParse,
  gap: ConfidenceGap,
  brief?: DiligenceBrief,
) {
  if (brief) {
    return buildFollowUpQuery(brief, parsed, gap);
  }
  return buildFollowUpQuery(
    {
      rawQuestion: parsed.subject,
      subject: parsed.subject,
      spendSignal: parsed.spendSignal,
      companyStage: parsed.companyStage,
      requestedSections: [],
    },
    parsed,
    gap,
  );
}
