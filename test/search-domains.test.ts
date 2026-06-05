import { describe, expect, it } from "vitest";
import { resolveSearchDomains } from "../lib/search-domains";

describe("resolveSearchDomains", () => {
  it("uses subject-aware market domains for GitHub Copilot", () => {
    const domains = resolveSearchDomains({
      subject: "GitHub Copilot",
      agent: "Market",
    });

    expect(domains).toEqual(
      expect.arrayContaining(["github.com"]),
    );
    expect(domains).not.toEqual(expect.arrayContaining(["apollo.io"]));
  });

  it("includes apollo.io for Apollo market searches", () => {
    const domains = resolveSearchDomains({
      subject: "Apollo.io",
      agent: "Market",
    });

    expect(domains).toEqual(expect.arrayContaining(["apollo.io"]));
  });

  it("omits market domains for unknown vendors when no strong subject match exists", () => {
    const domains = resolveSearchDomains({
      subject: "VeryUnusual Internal Tool",
      agent: "Market",
    });

    expect(domains).toBeUndefined();
  });
});
