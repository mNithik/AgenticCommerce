import { describe, expect, it } from "vitest";
import { parseQuestion } from "../lib/question-parse";
import { buildDiligenceBrief } from "../lib/diligence-brief";
import { buildAgentQuery, buildGapQuery } from "../lib/query-builder";

describe("question-faithful research planning", () => {
  it("builds Copilot queries that include competitive and use-case context", () => {
    const question =
      "Give me a competitive breakdown of GitHub Copilot for my Real-time Cryptocurrency Analytics Dashboard and tell me if the cost fits my developer needs.";
    const parsed = parseQuestion(question, "GitHub Copilot");
    const brief = buildDiligenceBrief(question, parsed);

    expect(buildAgentQuery(parsed, "Market", brief)).toMatch(/Cursor|Codeium|competitive/i);
    expect(buildAgentQuery(parsed, "Evidence", brief)).toMatch(/Dashboard|TypeScript|React|developer/i);
  });

  it("sanitizes general validation gaps instead of reusing raw claim prose", () => {
    const question = "Should I buy GitHub Copilot for my Real-time Cryptocurrency Analytics Dashboard?";
    const parsed = parseQuestion(question, "GitHub Copilot");
    const brief = buildDiligenceBrief(question, parsed);

    const query = buildGapQuery(
      parsed,
      {
        id: "gap_poison",
        title: "Gap",
        detail: "Unfortunately, I don't have any specific sources to draw from.",
        estimatedConfidenceGain: 0.06,
        estimatedCostUsd: 0.02,
        actionType: "paid_search",
        theme: "general_validation",
      },
      brief,
    );

    expect(query).not.toContain("Unfortunately");
    expect(query).toContain("GitHub Copilot");
  });
});
