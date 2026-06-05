import { describe, expect, it } from "vitest";
import { buildTavilyBody, minimalTavilyBody } from "../lib/search-payload";

describe("buildTavilyBody", () => {
  it("drops contradictory include_domains for Copilot queries", () => {
    const body = buildTavilyBody({
      query: "GitHub Copilot pricing category competitors seat economics",
      max_results: 5,
      include_domains: ["apollo.io", "hubspot.com"],
      search_depth: "basic",
    });

    expect(body).not.toHaveProperty("include_domains");
    expect(body).toHaveProperty("search_depth", "basic");
  });

  it("keeps matching include_domains for Apollo queries", () => {
    const body = buildTavilyBody({
      query: "Apollo.io pricing category competitors seat economics",
      max_results: 5,
      include_domains: ["apollo.io", "g2.com"],
    });

    expect(body).toHaveProperty("include_domains");
    expect(body.include_domains).toEqual(["apollo.io", "g2.com"]);
  });

  it("returns a minimal payload when requested", () => {
    const body = minimalTavilyBody({
      query: "GitHub Copilot pricing",
      max_results: 5,
      include_domains: ["github.com"],
      search_depth: "advanced",
      time_range: "year",
    });

    expect(body).toEqual({
      query: "GitHub Copilot pricing",
      max_results: 5,
      include_answer: false,
    });
  });
});
