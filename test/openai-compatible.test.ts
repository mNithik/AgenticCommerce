import { describe, expect, it } from "vitest";
import { OpenAICompatibleProvider } from "../lib/llm/openai-compatible";

describe("OpenAICompatibleProvider", () => {
  it("replaces placeholder analyst claims with grounded fallback claims", async () => {
    const provider = new OpenAICompatibleProvider({
      name: "nvidia",
      summaryModel: "test-summary",
      analystModel: "test-analyst",
    });

    (provider as any).complete = async () =>
      JSON.stringify({
        recommendation: "buy",
        confidence: 0.8,
        rationale: {
          claimText: "Rationale unavailable.",
          recordIds: ["record_market", "bad_record"],
          sourceUrls: ["https://valid.example/market", "https://bad.example"],
        },
        strengths: [
          {
            claimText: "Apollo has established market presence.",
            recordIds: ["record_market"],
            sourceUrls: ["https://valid.example/market"],
          },
          {
            claimText: "Strength 3",
            recordIds: ["record_evidence"],
            sourceUrls: ["https://valid.example/evidence"],
          },
        ],
        concerns: [
          {
            claimText: "Concern 2",
            recordIds: ["record_counter"],
            sourceUrls: ["https://valid.example/counter"],
          },
        ],
        nextSteps: [
          {
            claimText: "Next step 2",
            recordIds: ["record_market"],
            sourceUrls: ["https://valid.example/market"],
          },
        ],
      });

    const output = await provider.synthesizeAnalystOutput({
      question: "Should I buy Apollo.io?",
      subject: "Apollo.io",
      records: [
        {
          id: "record_market",
          agent: "Market",
          finding: "Apollo.io sits in a large and growing category.",
          sources: [
            {
              title: "Market report",
              url: "https://valid.example/market",
              snippet: "Large category",
            },
          ],
        },
        {
          id: "record_evidence",
          agent: "Evidence",
          finding: "Users report solid list-building productivity.",
          sources: [
            {
              title: "Evidence report",
              url: "https://valid.example/evidence",
              snippet: "Useful product",
            },
          ],
        },
        {
          id: "record_counter",
          agent: "Counter",
          finding: "There are lawsuits and data-quality complaints.",
          sources: [
            {
              title: "Counter report",
              url: "https://valid.example/counter",
              snippet: "Risk signal",
            },
          ],
        },
      ],
    });

    expect(output.rationale.claimText).not.toBe("Rationale unavailable.");
    expect(output.strengths.some((claim) => /^Strength \d+$/i.test(claim.claimText))).toBe(false);
    expect(output.concerns.some((claim) => /^Concern \d+$/i.test(claim.claimText))).toBe(false);
    expect(output.nextSteps.some((claim) => /^Next step \d+$/i.test(claim.claimText))).toBe(false);
    expect(output.rationale.recordIds.every((recordId) => recordId.startsWith("record_"))).toBe(true);
    expect(output.rationale.sourceUrls).not.toContain("https://bad.example");
    expect(output.recommendation).toBe("need_more_evidence");
  });
});
