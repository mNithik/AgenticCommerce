import { describe, expect, it } from "vitest";
import { parseQuestion } from "../lib/question-parse";
import { buildDiligenceBrief } from "../lib/diligence-brief";

describe("buildDiligenceBrief", () => {
  it("extracts use case, decision frame, and requested sections from a Copilot question", () => {
    const question =
      "Should I buy, wait, or avoid GitHub Copilot for my Real-time Cryptocurrency Analytics Dashboard project? Include a competitive breakdown and cost vs developer needs.";
    const parsed = parseQuestion(question, "GitHub Copilot");
    const brief = buildDiligenceBrief(question, parsed);

    expect(brief.useCaseContext).toContain("Real-time Cryptocurrency Analytics Dashboard");
    expect(brief.decisionFrame).toBe("wait");
    expect(brief.requestedSections).toEqual(
      expect.arrayContaining(["competitive", "pricing", "fit"]),
    );
  });
});
