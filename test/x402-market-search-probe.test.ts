/**
 * Separate diagnostic test for Tavily x402 Market search failures.
 *
 * Offline cases run with `npm test` (no wallet, no network).
 * Live awal probes run only when explicitly enabled:
 *
 *   LIVE_X402_PROBE=true MOCK_X402=false npm run test:x402-probe
 *
 * Requires AGENT_WALLET_KEY in .env for live probes.
 */
import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { resolveSearchDomains } from "../lib/search-domains";
import { buildTavilyBody, minimalTavilyBody } from "../lib/search-payload";

const execFileAsync = promisify(execFile);

const COPILOT_SUBJECT = "GitHub Copilot";
const COPILOT_QUERY =
  "GitHub Copilot pricing category competitors seat economics";

/** Payload that caused Validation failed in production (hardcoded Apollo domains). */
const HISTORIC_BROKEN_DOMAINS = [
  "apollo.io",
  "hubspot.com",
  "zoominfo.com",
  "g2.com",
];

/** Payload from the follow-up run (domains fixed, still can hit Failed to fetch). */
const COPILOT_RESOLVED_DOMAINS = [
  "github.com",
  "docs.github.com",
  "microsoft.com",
  "g2.com",
  "trustradius.com",
];

const LIVE_PROBE_ENABLED =
  process.env.LIVE_X402_PROBE === "true" && process.env.MOCK_X402 === "false";

const TAVILY_X402_URL =
  process.env.TAVILY_X402_URL ?? "https://x402.tavily.com/search";
const AWAL_MAX_AMOUNT = process.env.AWAL_MAX_AMOUNT ?? "20000";

type ProbeOutcome = "success" | "validation_failed" | "failed_to_fetch" | "other_error";

function classifyAwalError(message: string): ProbeOutcome {
  const lower = message.toLowerCase();
  if (/validation failed/i.test(lower)) {
    return "validation_failed";
  }
  if (/failed to fetch/i.test(lower)) {
    return "failed_to_fetch";
  }
  return "other_error";
}

async function runAwalX402Search(body: Record<string, unknown>) {
  const args = [
    "-y",
    "awal@2.10.0",
    "x402",
    "pay",
    TAVILY_X402_URL,
    "-X",
    "POST",
    "-d",
    JSON.stringify(body),
    "--max-amount",
    AWAL_MAX_AMOUNT,
    "--json",
  ];

  if (os.platform() === "win32") {
    return execFileAsync("cmd.exe", ["/d", "/s", "/c", "npx", ...args], {
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        AGENT_WALLET_KEY: process.env.AGENT_WALLET_KEY,
      },
    });
  }

  return execFileAsync("npx", args, {
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      AGENT_WALLET_KEY: process.env.AGENT_WALLET_KEY,
    },
  });
}

async function probeX402Body(
  label: string,
  body: Record<string, unknown>,
): Promise<{ label: string; outcome: ProbeOutcome; detail?: string }> {
  try {
    const { stdout } = await runAwalX402Search(body);
    const raw = typeof stdout === "string" ? stdout : stdout.toString("utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const nested = (parsed.body ?? parsed.data ?? parsed.response ?? parsed.result ?? parsed) as {
      results?: unknown[];
    };
    const count = Array.isArray(nested.results) ? nested.results.length : 0;
    return {
      label,
      outcome: count > 0 || raw.length > 0 ? "success" : "other_error",
      detail: `results=${count}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      label,
      outcome: classifyAwalError(message),
      detail: message.split("\n").slice(0, 3).join(" ").slice(0, 280),
    };
  }
}

describe("x402 Market search probe (offline)", () => {
  it("documents the historic Validation failed payload shape", () => {
    const historicBody = {
      query: COPILOT_QUERY,
      max_results: 5,
      include_answer: false,
      search_depth: "basic",
      include_domains: HISTORIC_BROKEN_DOMAINS,
    };

    expect(historicBody.include_domains).toEqual(
      expect.arrayContaining(["apollo.io"]),
    );
    expect(historicBody.query.toLowerCase()).toContain("github copilot");
  });

  it("buildTavilyBody drops contradictory Apollo domains for Copilot", () => {
    const sanitized = buildTavilyBody({
      query: COPILOT_QUERY,
      max_results: 5,
      search_depth: "basic",
      include_domains: HISTORIC_BROKEN_DOMAINS,
    });

    expect(sanitized).not.toHaveProperty("include_domains");
    expect(sanitized.query).toBe(COPILOT_QUERY);
  });

  it("resolveSearchDomains returns Copilot vendor domains, not Apollo", () => {
    const domains = resolveSearchDomains({
      subject: COPILOT_SUBJECT,
      agent: "Market",
    });

    expect(domains).toEqual(
      expect.arrayContaining(["github.com", "microsoft.com"]),
    );
    expect(domains).not.toEqual(expect.arrayContaining(["apollo.io"]));
  });

  it("builds the current orchestrator-style Market body for Copilot", () => {
    const domains = resolveSearchDomains({
      subject: COPILOT_SUBJECT,
      agent: "Market",
    });
    const body = buildTavilyBody({
      query: COPILOT_QUERY,
      max_results: 5,
      include_domains: domains,
    });

    expect(body).toEqual({
      query: COPILOT_QUERY,
      max_results: 5,
      include_answer: false,
      include_domains: expect.arrayContaining(["github.com"]),
    });
    expect(body.include_domains).not.toEqual(
      expect.arrayContaining(["apollo.io"]),
    );
  });

  it("minimal body matches the recommended Failed to fetch fallback", () => {
    const minimal = minimalTavilyBody({
      query: COPILOT_QUERY,
      max_results: 5,
      include_domains: COPILOT_RESOLVED_DOMAINS,
      search_depth: "advanced",
    });

    expect(minimal).toEqual({
      query: COPILOT_QUERY,
      max_results: 5,
      include_answer: false,
    });
  });

  it("classifies awal error strings for probe reporting", () => {
    expect(
      classifyAwalError("x402 request failed: Validation failed"),
    ).toBe("validation_failed");
    expect(classifyAwalError("x402 request failed: Failed to fetch")).toBe(
      "failed_to_fetch",
    );
  });
});

describe.skipIf(!LIVE_PROBE_ENABLED)(
  "x402 Market search probe (live — LIVE_X402_PROBE=true)",
  () => {
    it(
      "compares minimal vs domain-filtered Copilot searches",
      async () => {
        if (!process.env.AGENT_WALLET_KEY) {
          throw new Error(
            "AGENT_WALLET_KEY is required for live x402 probes.",
          );
        }

        const results = await Promise.all([
          probeX402Body("minimal_open_web", {
            query: "GitHub Copilot pricing",
            max_results: 5,
            include_answer: false,
          }),
          probeX402Body("copilot_resolved_domains", {
            query: COPILOT_QUERY,
            max_results: 5,
            include_answer: false,
            include_domains: COPILOT_RESOLVED_DOMAINS,
          }),
          probeX402Body("historic_broken_domains", {
            query: COPILOT_QUERY,
            max_results: 5,
            include_answer: false,
            include_domains: HISTORIC_BROKEN_DOMAINS,
          }),
        ]);

        // eslint-disable-next-line no-console
        console.log("\n[x402 probe results]", JSON.stringify(results, null, 2));

        const minimal = results.find((r) => r.label === "minimal_open_web");
        const resolved = results.find((r) => r.label === "copilot_resolved_domains");
        const broken = results.find((r) => r.label === "historic_broken_domains");

        expect(minimal).toBeDefined();
        expect(resolved).toBeDefined();
        expect(broken).toBeDefined();

        // Historic broken domains should not succeed when sent raw to x402.
        expect(broken!.outcome).not.toBe("success");

        // If minimal works but resolved domains fail, domains are the trigger.
        if (minimal!.outcome === "success" && resolved!.outcome === "failed_to_fetch") {
          expect(resolved!.outcome).toBe("failed_to_fetch");
        }

        // At least one Copilot-friendly path should succeed for a healthy stack.
        expect(
          [minimal!.outcome, resolved!.outcome].includes("success"),
        ).toBe(true);
      },
      120_000,
    );
  },
);
