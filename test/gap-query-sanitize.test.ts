import { describe, expect, it } from "vitest";
import { sanitizeGapQuery } from "../lib/gap-query-sanitize";

describe("sanitizeGapQuery", () => {
  it("removes poisoned apology-style follow-up queries", () => {
    const query = sanitizeGapQuery(
      {
        rawQuestion: "Should I buy GitHub Copilot for my dashboard?",
        subject: "GitHub Copilot",
        useCaseContext: "Real-time Cryptocurrency Analytics Dashboard",
        requestedSections: ["competitive", "fit"],
      },
      {
        id: "gap_bad",
        title: "Bad gap",
        estimatedConfidenceGain: 0.05,
        estimatedCostUsd: 0.02,
        suggestedQuery: "GitHub Copilot Unfortunately, I don't have any specific sources to draw from",
        actionType: "paid_search",
        theme: "general_validation",
      },
    );

    expect(query).not.toContain("Unfortunately");
    expect(query).toContain("GitHub Copilot");
  });
});
