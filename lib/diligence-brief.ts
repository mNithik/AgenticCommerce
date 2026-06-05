import type { DiligenceBrief, DiligenceRequestedSection } from "./types";
import type { QuestionParse } from "./question-parse";

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function detectUseCaseContext(question: string) {
  const bracket = question.match(/\[([^\]]+)\]/);
  if (bracket?.[1]?.trim()) {
    return bracket[1].trim();
  }

  const building = question.match(/\b(?:for|building|for my)\s+(?:a|an)?\s*([^?.]+)/i);
  if (building?.[1]?.trim()) {
    return building[1].trim();
  }

  return undefined;
}

function detectDecisionFrame(question: string): DiligenceBrief["decisionFrame"] {
  if (/\bbuy\b.*\bwait\b.*\bavoid\b|\bwait\b.*\bbuy\b.*\bavoid\b/i.test(question)) {
    return "wait";
  }
  if (/\bshould i (?:buy|subscribe|purchase|spend)\b/i.test(question)) {
    return "spend";
  }
  return undefined;
}

function detectRequestedSections(
  question: string,
  parsed: QuestionParse,
  useCaseContext?: string,
) {
  const sections: DiligenceRequestedSection[] = [];
  if (/\bcompetitive breakdown\b|\bcompetitors\b|\bvs\b/i.test(question)) {
    sections.push("competitive");
  }
  if (/\bcost\b|\bpricing\b|\bsubscription\b|\bper month\b/i.test(question)) {
    sections.push("pricing");
  }
  if (/\bworth\b|\broi\b|\bpayback\b/i.test(question)) {
    sections.push("roi");
  }
  if (/\blegal\b|\bprivacy\b|\bcopyright\b|\blawsuit\b|\bcompliance\b/i.test(question)) {
    sections.push("legal");
  }
  if (/\bimplementation\b|\bonboarding\b|\bsetup\b/i.test(question)) {
    sections.push("implementation");
  }
  if (/\bdeveloper needs\b|\bfor my\b|\bgiven that i am\b|\buse case\b/i.test(question)) {
    sections.push("fit");
  }

  if (parsed.intents.includes("pricing")) sections.push("pricing");
  if (parsed.intents.includes("roi")) sections.push("roi");
  if (parsed.intents.includes("implementation")) sections.push("implementation");
  if (parsed.intents.includes("legal_compliance")) sections.push("legal");
  if (useCaseContext) sections.push("fit");

  return unique(sections);
}

export function buildDiligenceBrief(question: string, parsed: QuestionParse): DiligenceBrief {
  const useCaseContext = detectUseCaseContext(question);
  const requestedSections = detectRequestedSections(question, parsed, useCaseContext);

  return {
    rawQuestion: question,
    subject: parsed.subject,
    useCaseContext,
    decisionFrame: detectDecisionFrame(question),
    requestedSections,
    spendSignal: parsed.spendSignal,
    companyStage: parsed.companyStage,
  };
}
