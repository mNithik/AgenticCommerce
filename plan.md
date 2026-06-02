# Autonomous Venture Analyst — Implementation Plan (v2, merged)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A web app where a user submits a startup idea and a team of agents autonomously researches it — paying per web search in USDC via Coinbase `awal` + Tavily x402 — then returns a venture memo whose every claim is traceable back to an agent record, a source URL, and an on-chain payment receipt.

**Architecture:** A Node/TypeScript Express backend runs four agents. Three research agents (Market, Pain, Counter) run **in parallel**; each calls a `paidSearch()` wrapper that — in `live` mode — shells out to the `awal` CLI to sign + settle a Tavily x402 micropayment, or — in `mock` mode (the default) — returns deterministic fixtures with no spend. Each search produces an `EvidenceRecord` with a stable `id` and source rows. A fourth Analyst agent synthesizes the three reports into **structured claims** (`MemoClaim`, each citing record ids + source URLs), then renders the memo from that structure. A compact **SafeSpend** pre-flight check enforces a budget cap and de-dupes queries before any paid calls fire. The orchestrator streams every step to a single-page frontend over SSE, including the payment mode, running USDC spend, policy events, and receipts.

**Tech Stack:** Node 22 + TypeScript (run via `tsx`, no build step), Express, `openai` SDK pointed at NVIDIA NIM (OpenAI-compatible), `awal` CLI v2.10.0 (subprocess) for x402 payments, `vitest` for unit tests, plain HTML/JS/CSS frontend (no framework).

**See also:** `context.md` for project background, the demo story, and verified API facts.

### What changed from v1 (adopted from the ProofSpend revision)
1. **Mock mode by default** — deterministic fixtures; `live` x402 only via server env. Build/test/CI for free; guaranteed demo fallback.
2. **Claim-level citations** — analyst emits `MemoClaim[]` (claimText + recordIds + sourceUrls) first, then renders markdown. Judges can trace memo → record → source → receipt.
3. **Richer `paidSearch()` + real-price parsing** — returns `{ recordId, provider, paymentMode, costUsd, receipt, rows }`; parses the actual cost from awal; the hardcoded `$0.01` is only the *mock* price. In live mode, a search that yields no parseable receipt **fails closed**.
4. **SafeSpend (lite)** — pre-flight budget cap + duplicate-query dedupe + hard cap on paid calls; emits `policy_blocked` events.
5. **paymentMode badge + tightened SSE contract** — mode emitted in the first event; stream ends with exactly one terminal event (`done` or `error`).

**Deliberately NOT adopted from ProofSpend:** Next.js 15 (Express+static is faster to ship), query redaction (showing the queries is a demo asset), sequential ordering (we keep parallel + pre-flight), and the conditional Skeptic agent (left as an optional stretch in Task 13).

---

## File Structure

```
package.json            scripts + deps
tsconfig.json           TS config for tsx/vitest
.gitignore              ignore node_modules, .env
.env.example            documents required env vars
.env                    (gitignored) real keys — created by user
src/
  config.ts             env loading, models, endpoints, PAYMENT_MODE, budget caps
  types.ts              shared types (EvidenceRecord, AgentReport, MemoClaim, Memo, RunEvent)
  llm.ts                NVIDIA NIM chat client (+ template fallback when no key)
  tavily.ts             paidSearch(): mock fixtures OR awal x402 subprocess; output parser
  safespend.ts          pre-flight policy: budget cap, query dedupe, hard call cap
  agents/
    researchAgent.ts    factory: market/pain/counter (search -> evidence -> summarize)
    analystAgent.ts     synthesize reports -> MemoClaim[] -> Memo
  orchestrator.ts       payment mode, safespend, run agents, tally, emit RunEvents
  server.ts             Express: serve page + SSE run endpoint
  mock/
    searchFixtures.ts   deterministic fixtures keyed by agent + normalized subject
public/
  index.html            demo UI: mode badge, live log, spend, policy events, memo+citations, receipts
test/
  tavily.parse.test.ts  unit: parse awal --json output
  spend.test.ts         unit: spend tally + USDC formatting
  safespend.test.ts     unit: budget cap, dedupe, call cap
  mock.test.ts          unit: mock paidSearch is deterministic + needs no wallet
scripts/
  probe-awal.ts         one-off: discover real awal --json shape
  smoke-llm.ts          one-off: verify NVIDIA key + both models
  smoke-search.ts       one-off: verify one real (live) Tavily x402 search
```

**Responsibility boundaries:**
- `tavily.ts` is the *only* place that knows how to talk to `awal` or the mock fixtures. Everyone else consumes a clean `PaidSearch`.
- `llm.ts` is the *only* place that knows about NVIDIA/OpenAI SDK.
- `safespend.ts` is pure policy logic (no I/O) — fully unit-testable.
- `orchestrator.ts` owns the run lifecycle, payment mode, and event emission.
- `server.ts` is transport only.

---

## Task 0: Confirm prerequisites

Mock mode (the default) needs **nothing external** — the whole app builds and runs without a wallet. These prerequisites gate only **live** runs (Tasks where noted).

- [ ] **Step 1: NVIDIA API key (needed for real LLM output in any mode).** Get a free key at build.nvidia.com → save for `.env` (`NVIDIA_API_KEY=nvapi-...`). (If absent, the template fallback in `llm.ts` still lets mock mode complete — useful for CI.)
- [ ] **Step 2 (LIVE ONLY): Authenticate awal.** `npx awal auth login acharya.pre@northeastern.edu` → `npx awal auth verify <flow-id> <otp>`. Expected: `npx awal status` shows authenticated.
- [ ] **Step 3 (LIVE ONLY): Fund wallet on Base mainnet.** `npx awal balance` / `npx awal address`. Need > ~$0.10 USDC on Base (Tavily x402 is mainnet-only; ~$0.01/search).

---

## Task 1: Project scaffold

**Files:** Create `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`

- [ ] **Step 1: package.json**

```json
{
  "name": "autonomous-venture-analyst",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx src/server.ts",
    "test": "vitest run",
    "probe:awal": "tsx scripts/probe-awal.ts",
    "smoke:llm": "tsx scripts/smoke-llm.ts",
    "smoke:search": "tsx scripts/smoke-search.ts"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "openai": "^4.67.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.7.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src", "test", "scripts"]
}
```

- [ ] **Step 3: .gitignore**

```
node_modules/
.env
*.log
.DS_Store
```

- [ ] **Step 4: .env.example**

```
# Payment mode: mock (default, no spend) or live (real USDC via awal on Base mainnet)
PAYMENT_MODE=mock

# NVIDIA NIM (free at build.nvidia.com) — OpenAI-compatible
NVIDIA_API_KEY=nvapi-xxxxxxxx
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
MODEL_RESEARCH=meta/llama-3.3-70b-instruct
MODEL_ANALYST=meta/llama-3.1-405b-instruct

# Tavily x402 (Base mainnet, live mode only)
TAVILY_X402_URL=https://x402.tavily.com/search
# Per-search safety cap in USDC atomic units (6 decimals): 0.02 = 20000
AWAL_MAX_AMOUNT=20000
# Price assumed for a search in MOCK mode (live mode parses the real cost)
MOCK_SEARCH_PRICE_USD=0.01

# SafeSpend policy
BUDGET_CAP_USD=0.10
HARD_CALL_CAP=8

PORT=3000
```

- [ ] **Step 5: Install** — Run `npm install`. Expected: no errors. (User copies `.env.example` → `.env`.)
- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json .gitignore .env.example package-lock.json
git commit -m "chore: scaffold project (deps, tsconfig, env template with mock mode)"
```

---

## Task 2: Shared types

**Files:** Create `src/types.ts`

- [ ] **Step 1: Write types.ts**

```ts
export type PaymentMode = "mock" | "live";

export interface SearchRow {
  title: string;
  url: string;
  content: string;
}

// One paid (or mock) search + its evidence and payment metadata.
export interface PaidSearch {
  recordId: string;       // stable id, e.g. "market-0" — cited by the memo
  agent: string;          // "Market" | "Pain" | "Counter"
  query: string;
  provider: string;       // "tavily-x402"
  paymentMode: PaymentMode;
  rows: SearchRow[];
  answer?: string;        // Tavily include_answer summary, if present
  costUsd: number;        // real parsed cost (live) or configured mock price
  receipt?: string;       // on-chain settlement tx hash; REQUIRED in live mode
}

export interface AgentReport {
  agent: string;          // "Market" | "Pain" | "Counter"
  report: string;         // LLM-written summary
  searches: PaidSearch[];
}

// A single memo claim grounded in evidence.
export interface MemoClaim {
  claimText: string;
  recordIds: string[];    // EvidenceRecord ids backing this claim
  sourceUrls: string[];   // source URLs backing this claim
}

export interface Memo {
  opportunity: string;
  claims: MemoClaim[];     // structured, grounded claims
  recommendation: "PROCEED" | "KILL";
  rationale: string;
}

export interface RunResult {
  idea: string;
  paymentMode: PaymentMode;
  reports: AgentReport[];
  memo: Memo;
  totalSpentUsd: number;
  totalSearches: number;
  receipts: string[];
}

// Events streamed to the frontend over SSE.
export type RunEvent =
  | { type: "run_started"; paymentMode: PaymentMode; budgetCapUsd: number; idea: string }
  | { type: "status"; message: string }
  | { type: "agent_start"; agent: string }
  | { type: "search"; agent: string; query: string }
  | { type: "search_done"; agent: string; query: string; costUsd: number; receipt?: string; resultCount: number }
  | { type: "agent_done"; agent: string; report: string }
  | { type: "spend_update"; totalSpentUsd: number; totalSearches: number }
  | { type: "policy_blocked"; reason: string; spentUsd: number }
  | { type: "memo"; memo: Memo }
  | { type: "done"; result: RunResult }
  | { type: "error"; message: string };
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: shared types incl. evidence records, memo claims, payment mode"
```

---

## Task 3: Config

**Files:** Create `src/config.ts`

- [ ] **Step 1: Write config.ts**

```ts
import "dotenv/config";
import type { PaymentMode } from "./types.js";

export const config = {
  paymentMode: (process.env.PAYMENT_MODE === "live" ? "live" : "mock") as PaymentMode,
  nvidiaApiKey: process.env.NVIDIA_API_KEY ?? "",
  nvidiaBaseUrl: process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
  modelResearch: process.env.MODEL_RESEARCH ?? "meta/llama-3.3-70b-instruct",
  modelAnalyst: process.env.MODEL_ANALYST ?? "meta/llama-3.1-405b-instruct",
  tavilyX402Url: process.env.TAVILY_X402_URL ?? "https://x402.tavily.com/search",
  awalMaxAmount: process.env.AWAL_MAX_AMOUNT ?? "20000",
  mockSearchPriceUsd: Number(process.env.MOCK_SEARCH_PRICE_USD ?? "0.01"),
  budgetCapUsd: Number(process.env.BUDGET_CAP_USD ?? "0.10"),
  hardCallCap: Number(process.env.HARD_CALL_CAP ?? "8"),
  port: Number(process.env.PORT ?? 3000),
};

export function assertLiveReady(): void {
  // Called only when entering live mode; mock mode needs none of this.
  if (config.paymentMode === "live" && !config.tavilyX402Url) {
    throw new Error("live mode requires TAVILY_X402_URL");
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/config.ts
git commit -m "feat: config with payment mode + safespend caps"
```

---

## Task 4: Mock fixtures

**Files:** Create `src/mock/searchFixtures.ts`, `test/mock.test.ts`

- [ ] **Step 1: Write searchFixtures.ts**

```ts
import type { SearchRow } from "../types.js";

// Deterministic fixtures keyed by agent. Returned in mock mode so the whole
// app runs with no wallet, no network, no spend. Content references the idea
// so summaries stay plausible during a demo.
export function mockRows(agent: string, idea: string, query: string): { rows: SearchRow[]; answer: string } {
  const base: Record<string, SearchRow[]> = {
    Market: [
      { title: `${idea} — market overview`, url: "https://example.com/market", content: `The ${idea} market is estimated at ~$4.2B in 2026, growing ~14% YoY. Leading players include three well-funded incumbents.` },
      { title: `${idea} funding tracker`, url: "https://example.com/funding", content: `Notable raises: $30M Series B in 2025; several seed-stage entrants in 2026.` },
    ],
    Pain: [
      { title: `${idea} user complaints`, url: "https://example.com/reddit", content: `Common complaints: high cost, poor onboarding, and slow support. Users on forums report churn after 2 months.` },
      { title: `${idea} reviews`, url: "https://example.com/reviews", content: `Reviewers cite a confusing UX and missing integrations as top frustrations.` },
    ],
    Counter: [
      { title: `Why ${idea} startups fail`, url: "https://example.com/postmortem", content: `Prior entrants failed due to thin margins, high CAC, and regulatory friction. One shut down in 2024 after running out of runway.` },
      { title: `${idea} risks`, url: "https://example.com/risks", content: `Key risks: incumbent bundling, low willingness to pay, and compliance overhead.` },
    ],
  };
  const rows = base[agent] ?? base.Market;
  return { rows, answer: `Mock summary for "${query}": ${rows[0].content}` };
}
```

- [ ] **Step 2: Write mock.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { mockRows } from "../src/mock/searchFixtures.js";

describe("mockRows", () => {
  it("is deterministic for the same agent", () => {
    const a = mockRows("Market", "pet healthcare", "q1");
    const b = mockRows("Market", "pet healthcare", "q1");
    expect(a.rows).toEqual(b.rows);
  });
  it("returns agent-specific content", () => {
    expect(mockRows("Pain", "x", "q").rows[0].url).toContain("reddit");
    expect(mockRows("Counter", "x", "q").rows[0].title.toLowerCase()).toContain("fail");
  });
});
```

- [ ] **Step 3: Run** — `npm test -- mock`. Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add src/mock/searchFixtures.ts test/mock.test.ts
git commit -m "feat: deterministic mock search fixtures (no wallet/network needed)"
```

---

## Task 5: Discover awal --json shape, then build tavily.ts

**Files:** Create `scripts/probe-awal.ts`, `src/tavily.ts`, `test/tavily.parse.test.ts`

- [ ] **Step 1: Write probe-awal.ts**

```ts
// scripts/probe-awal.ts — prints raw awal output so we can see the JSON shape (LIVE).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const pexec = promisify(execFile);

const url = process.env.TAVILY_X402_URL ?? "https://x402.tavily.com/search";
const body = JSON.stringify({ query: "electric vehicle market size 2026", max_results: 3 });
const args = ["-y", "awal", "x402", "pay", url, "-X", "POST", "-d", body, "--max-amount", "20000", "--json"];
console.log("Running: npx", args.join(" "));
const { stdout, stderr } = await pexec("npx", args, { maxBuffer: 10 * 1024 * 1024 });
console.log("=== STDERR ===\n", stderr);
console.log("=== STDOUT ===\n", stdout);
```

- [ ] **Step 2: Check help** — Run `npx awal x402 pay --help`. Expected: confirms `-X -d -h -q --max-amount --json`.
- [ ] **Step 3: Run the probe (LIVE — requires Task 0 live prereqs; spends ~$0.01)** — `npm run probe:awal`. **Record the real shape**: where the Tavily body (`results[]`, `answer`) and the settlement tx hash live. Adjust the candidate keys in `extractFromAwalJson` (Step 4) to match.
- [ ] **Step 4: Write tavily.ts**

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.js";
import { mockRows } from "./mock/searchFixtures.js";
import type { PaidSearch, SearchRow } from "./types.js";

const pexec = promisify(execFile);

// Parse awal --json output. Tolerant of nesting; finalize keys after probe (Task 5 Step 3).
export function extractFromAwalJson(raw: string): {
  rows: SearchRow[]; answer?: string; receipt?: string; costUsd?: number;
} {
  const root = JSON.parse(raw);
  const bodyCandidates = [root.body, root.data, root.response, root.result, root];
  let body: any = {};
  for (const c of bodyCandidates) {
    if (c && (Array.isArray(c.results) || typeof c.answer === "string")) { body = c; break; }
  }
  const rows: SearchRow[] = Array.isArray(body.results)
    ? body.results.map((r: any) => ({ title: r.title ?? "", url: r.url ?? "", content: r.content ?? r.raw_content ?? "" }))
    : [];

  const pay = root.payment ?? root.settlement ?? root.paymentResponse ?? {};
  const receipt: string | undefined =
    pay.transactionHash ?? pay.txHash ?? pay.transaction ?? pay.hash ?? root.txHash;

  let costUsd: number | undefined;
  const amt = pay.amount ?? pay.value;
  if (typeof amt === "number") costUsd = amt > 1000 ? amt / 1e6 : amt;
  else if (typeof amt === "string" && amt.trim() !== "") {
    const n = Number(amt);
    if (!Number.isNaN(n)) costUsd = n > 1000 ? n / 1e6 : n;
  }
  return { rows, answer: body.answer, receipt, costUsd };
}

async function liveSearch(query: string, maxResults: number): Promise<Omit<PaidSearch, "recordId" | "agent">> {
  const body = JSON.stringify({ query, max_results: maxResults, include_answer: true });
  const args = ["-y", "awal", "x402", "pay", config.tavilyX402Url, "-X", "POST", "-d", body, "--max-amount", config.awalMaxAmount, "--json"];
  const { stdout } = await pexec("npx", args, { maxBuffer: 10 * 1024 * 1024 });
  const parsed = extractFromAwalJson(stdout);
  // FAIL CLOSED: a live paid call with no parseable receipt is an error, not a silent degrade.
  if (!parsed.receipt) {
    throw new Error(`live x402 search returned no parseable receipt for query: "${query}"`);
  }
  return {
    query, provider: "tavily-x402", paymentMode: "live",
    rows: parsed.rows, answer: parsed.answer,
    costUsd: parsed.costUsd ?? config.mockSearchPriceUsd, receipt: parsed.receipt,
  };
}

function mockSearch(agent: string, idea: string, query: string): Omit<PaidSearch, "recordId" | "agent"> {
  const { rows, answer } = mockRows(agent, idea, query);
  return {
    query, provider: "tavily-x402", paymentMode: "mock",
    rows, answer, costUsd: config.mockSearchPriceUsd,
    receipt: `0xmock${Math.random().toString(16).slice(2, 10)}`,
  };
}

export async function paidSearch(
  agent: string, idea: string, query: string, recordId: string, maxResults = 5,
): Promise<PaidSearch> {
  const core = config.paymentMode === "live"
    ? await liveSearch(query, maxResults)
    : mockSearch(agent, idea, query);
  return { recordId, agent, ...core };
}
```

- [ ] **Step 5: Write tavily.parse.test.ts** (replace `RAW` with real probe output once available)

```ts
import { describe, it, expect } from "vitest";
import { extractFromAwalJson } from "../src/tavily.js";

const RAW = JSON.stringify({
  status: 200,
  body: { results: [{ title: "EV", url: "https://example.com/ev", content: "EV market $500B in 2026." }], answer: "EV market ~$500B." },
  payment: { transactionHash: "0xabc123", amount: 10000 },
});

describe("extractFromAwalJson", () => {
  it("pulls rows, answer, receipt, and cost", () => {
    const out = extractFromAwalJson(RAW);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].url).toBe("https://example.com/ev");
    expect(out.receipt).toBe("0xabc123");
    expect(out.costUsd).toBeCloseTo(0.01, 6);
  });
  it("handles missing payment info", () => {
    const out = extractFromAwalJson(JSON.stringify({ body: { results: [] } }));
    expect(out.rows).toEqual([]);
    expect(out.receipt).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run** — `npm test -- tavily.parse`. Expected: PASS.
- [ ] **Step 7: Commit**

```bash
git add scripts/probe-awal.ts src/tavily.ts test/tavily.parse.test.ts
git commit -m "feat: paidSearch (mock fixtures or live awal x402) + tolerant parser, fail-closed live"
```

---

## Task 6: SafeSpend policy

**Files:** Create `src/safespend.ts`, `test/safespend.test.ts`

- [ ] **Step 1: Write safespend.ts**

```ts
import { config } from "./config.js";

export interface PlannedCall { agent: string; query: string; }

export interface PolicyDecision { ok: boolean; reason?: string; projectedSpendUsd: number; }

// Normalize a query for dedupe (lowercase, collapse whitespace).
export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

// Pre-flight: before any paid call fires, verify the whole batch is within policy.
export function checkBatch(calls: PlannedCall[], pricePerCallUsd: number): PolicyDecision {
  const projectedSpendUsd = Math.round(calls.length * pricePerCallUsd * 1e6) / 1e6;

  if (calls.length > config.hardCallCap) {
    return { ok: false, reason: `call count ${calls.length} exceeds hard cap ${config.hardCallCap}`, projectedSpendUsd };
  }
  const seen = new Set<string>();
  for (const c of calls) {
    const key = normalizeQuery(c.query);
    if (seen.has(key)) return { ok: false, reason: `duplicate query blocked: "${c.query}"`, projectedSpendUsd };
    seen.add(key);
  }
  if (projectedSpendUsd > config.budgetCapUsd) {
    return { ok: false, reason: `projected spend $${projectedSpendUsd.toFixed(2)} exceeds budget cap $${config.budgetCapUsd.toFixed(2)}`, projectedSpendUsd };
  }
  return { ok: true, projectedSpendUsd };
}
```

- [ ] **Step 2: Write safespend.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { checkBatch, normalizeQuery } from "../src/safespend.js";

describe("safespend.checkBatch", () => {
  const calls = (n: number) => Array.from({ length: n }, (_, i) => ({ agent: "A", query: `q${i}` }));

  it("passes a normal batch", () => {
    const d = checkBatch(calls(6), 0.01);
    expect(d.ok).toBe(true);
    expect(d.projectedSpendUsd).toBeCloseTo(0.06, 6);
  });
  it("blocks over budget cap (default $0.10)", () => {
    const d = checkBatch(calls(8), 0.02); // $0.16 > $0.10
    expect(d.ok).toBe(false);
    expect(d.reason).toContain("budget cap");
  });
  it("blocks duplicate normalized queries", () => {
    const d = checkBatch([{ agent: "A", query: "EV  market" }, { agent: "B", query: "ev market" }], 0.01);
    expect(d.ok).toBe(false);
    expect(d.reason).toContain("duplicate");
  });
  it("normalizes queries", () => {
    expect(normalizeQuery("  EV   Market ")).toBe("ev market");
  });
});
```

- [ ] **Step 3: Run** — `npm test -- safespend`. Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add src/safespend.ts test/safespend.test.ts
git commit -m "feat: SafeSpend pre-flight policy (budget cap, dedupe, call cap) + tests"
```

---

## Task 7: LLM client (with fallback)

**Files:** Create `src/llm.ts`, `scripts/smoke-llm.ts`

- [ ] **Step 1: Write llm.ts**

```ts
import OpenAI from "openai";
import { config } from "./config.js";

const client = config.nvidiaApiKey
  ? new OpenAI({ apiKey: config.nvidiaApiKey, baseURL: config.nvidiaBaseUrl })
  : null;

export async function chat(model: string, system: string, user: string): Promise<string> {
  if (!client) {
    // Template fallback so mock/CI runs complete with no API key.
    return `[no-LLM fallback] ${system.slice(0, 60)} :: ${user.slice(0, 200)}`;
  }
  const res = await client.chat.completions.create({
    model, temperature: 0.4,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

export async function chatJson<T>(model: string, system: string, user: string, fallback: T): Promise<T> {
  if (!client) return fallback;
  const raw = await chat(model, system + "\nRespond with ONLY valid JSON. No prose, no code fences.", user);
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(cleaned) as T; } catch { return fallback; }
}
```

- [ ] **Step 2: Write smoke-llm.ts**

```ts
import { config } from "../src/config.js";
import { chat } from "../src/llm.js";
for (const model of [config.modelResearch, config.modelAnalyst]) {
  process.stdout.write(`\n[${model}] ... `);
  console.log(JSON.stringify(await chat(model, "You are terse.", "Reply with exactly: OK")));
}
```

- [ ] **Step 3: Run (needs NVIDIA_API_KEY)** — `npm run smoke:llm`. Expected: both models reply. Fix model ids in `.env` if rejected.
- [ ] **Step 4: Commit**

```bash
git add src/llm.ts scripts/smoke-llm.ts
git commit -m "feat: NVIDIA NIM chat client with no-key template fallback"
```

---

## Task 8: Research agents

**Files:** Create `src/agents/researchAgent.ts`

- [ ] **Step 1: Write researchAgent.ts**

```ts
import { config } from "../config.js";
import { chat } from "../llm.js";
import { paidSearch } from "../tavily.js";
import type { AgentReport, PaidSearch, RunEvent } from "../types.js";

export interface ResearchAgentSpec {
  name: string;
  system: string;
  queries: (idea: string) => string[];
}

export const MARKET_AGENT: ResearchAgentSpec = {
  name: "Market",
  system: "You are a market research analyst. Using ONLY the provided search results, summarize market size/TAM, growth trend, and main players. Cite numbers when present. 150 words max.",
  queries: (idea) => [`${idea} market size TAM 2026`, `${idea} top competitors companies funding`],
};
export const PAIN_AGENT: ResearchAgentSpec = {
  name: "Pain",
  system: "You are a user-research analyst. Using ONLY the provided search results, list REAL pain points and complaints (reviews, forums, Reddit). Quote specifics. 150 words max.",
  queries: (idea) => [`${idea} problems complaints reddit`, `${idea} customer reviews frustrations`],
};
export const COUNTER_AGENT: ResearchAgentSpec = {
  name: "Counter",
  system: "You are a skeptical due-diligence analyst. Using ONLY the provided search results, explain why similar ideas FAILED before and the biggest risks. Be blunt. 150 words max.",
  queries: (idea) => [`${idea} startup failed shut down why`, `${idea} risks challenges regulation`],
};

export async function runResearchAgent(
  spec: ResearchAgentSpec, idea: string, emit: (e: RunEvent) => void,
): Promise<AgentReport> {
  emit({ type: "agent_start", agent: spec.name });
  const searches: PaidSearch[] = [];
  const queries = spec.queries(idea);

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    emit({ type: "search", agent: spec.name, query: q });
    const recordId = `${spec.name.toLowerCase()}-${i}`;
    const s = await paidSearch(spec.name, idea, q, recordId);
    searches.push(s);
    emit({ type: "search_done", agent: spec.name, query: q, costUsd: s.costUsd, receipt: s.receipt, resultCount: s.rows.length });
  }

  const context = searches.map((s) =>
    `## Record ${s.recordId} — Query: ${s.query}\n${s.answer ? `Summary: ${s.answer}\n` : ""}` +
    s.rows.map((r) => `- [${r.url}] ${r.title}: ${r.content}`).join("\n")
  ).join("\n\n");

  const report = await chat(config.modelResearch, spec.system, `Startup idea: "${idea}"\n\nSearch results:\n${context}`);
  emit({ type: "agent_done", agent: spec.name, report });
  return { agent: spec.name, report, searches };
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`. Expected: no errors.
- [ ] **Step 3: Commit**

```bash
git add src/agents/researchAgent.ts
git commit -m "feat: research agents emit evidence records with stable ids"
```

---

## Task 9: Analyst agent (claim-grounded)

**Files:** Create `src/agents/analystAgent.ts`

- [ ] **Step 1: Write analystAgent.ts**

```ts
import { config } from "../config.js";
import { chatJson } from "../llm.js";
import type { AgentReport, Memo, MemoClaim } from "../types.js";

const SYSTEM =
  "You are a venture analyst writing a grounded investment memo. You are given research reports, each tagged with " +
  "evidence Record ids and source URLs. Produce structured claims FIRST. Every claim MUST cite at least one recordId " +
  "and at least one sourceUrl that actually appears in the input. Then give a decisive PROCEED or KILL with a one-sentence rationale.";

interface RawMemo { opportunity: string; claims: MemoClaim[]; recommendation: string; rationale: string; }

export async function runAnalyst(idea: string, reports: AgentReport[]): Promise<Memo> {
  // Build the evidence catalogue the model is allowed to cite.
  const validRecordIds = new Set<string>();
  const validUrls = new Set<string>();
  const catalogue = reports.map((r) => {
    const recs = r.searches.map((s) => {
      validRecordIds.add(s.recordId);
      s.rows.forEach((row) => row.url && validUrls.add(row.url));
      return `Record ${s.recordId}: ${s.rows.map((row) => row.url).filter(Boolean).join(", ")}`;
    }).join("\n");
    return `### ${r.agent} report\n${r.report}\nEvidence:\n${recs}`;
  }).join("\n\n");

  const user =
    `Startup idea: "${idea}"\n\n${catalogue}\n\n` +
    `Return JSON: {"opportunity": string, "claims": [{"claimText": string, "recordIds": string[], "sourceUrls": string[]}], ` +
    `"recommendation": "PROCEED" | "KILL", "rationale": string}. Max 5 claims.`;

  const fallback: RawMemo = {
    opportunity: reports[0]?.report?.slice(0, 200) ?? "",
    claims: [], recommendation: "PROCEED", rationale: "Insufficient model output; defaulting.",
  };
  const raw = await chatJson<RawMemo>(config.modelAnalyst, SYSTEM, user, fallback);

  // Drop any citation the model invented; keep only grounded ones.
  const claims: MemoClaim[] = (raw.claims ?? []).slice(0, 5).map((c) => ({
    claimText: c.claimText ?? "",
    recordIds: (c.recordIds ?? []).filter((id) => validRecordIds.has(id)),
    sourceUrls: (c.sourceUrls ?? []).filter((u) => validUrls.has(u)),
  })).filter((c) => c.claimText);

  return {
    opportunity: raw.opportunity ?? "",
    claims,
    recommendation: raw.recommendation === "KILL" ? "KILL" : "PROCEED",
    rationale: raw.rationale ?? "",
  };
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`. Expected: no errors.
- [ ] **Step 3: Commit**

```bash
git add src/agents/analystAgent.ts
git commit -m "feat: analyst emits grounded MemoClaims (citations validated against evidence)"
```

---

## Task 10: Orchestrator (mode + SafeSpend + tally)

**Files:** Create `src/orchestrator.ts`, `test/spend.test.ts`

- [ ] **Step 1: Write orchestrator.ts**

```ts
import { config, assertLiveReady } from "./config.js";
import { runResearchAgent, MARKET_AGENT, PAIN_AGENT, COUNTER_AGENT } from "./agents/researchAgent.js";
import { runAnalyst } from "./agents/analystAgent.js";
import { checkBatch, type PlannedCall } from "./safespend.js";
import type { AgentReport, RunEvent, RunResult } from "./types.js";

export function tally(reports: AgentReport[]): { totalSpentUsd: number; totalSearches: number; receipts: string[] } {
  let totalSpentUsd = 0, totalSearches = 0;
  const receipts: string[] = [];
  for (const r of reports) for (const s of r.searches) {
    totalSpentUsd += s.costUsd; totalSearches += 1;
    if (s.receipt) receipts.push(s.receipt);
  }
  return { totalSpentUsd: Math.round(totalSpentUsd * 1e6) / 1e6, totalSearches, receipts };
}

export async function runVentureAnalysis(idea: string, emit: (e: RunEvent) => void): Promise<RunResult | null> {
  emit({ type: "run_started", paymentMode: config.paymentMode, budgetCapUsd: config.budgetCapUsd, idea });
  assertLiveReady();

  // Pre-flight: collect every planned paid call and check policy BEFORE spending.
  const specs = [MARKET_AGENT, PAIN_AGENT, COUNTER_AGENT];
  const planned: PlannedCall[] = specs.flatMap((s) => s.queries(idea).map((q) => ({ agent: s.name, query: q })));
  const pricePerCall = config.paymentMode === "live" ? config.mockSearchPriceUsd : config.mockSearchPriceUsd;
  const decision = checkBatch(planned, pricePerCall);
  if (!decision.ok) {
    emit({ type: "policy_blocked", reason: decision.reason ?? "blocked", spentUsd: 0 });
    emit({ type: "error", message: `SafeSpend blocked the run: ${decision.reason}` });
    return null;
  }

  emit({ type: "status", message: `Mode: ${config.paymentMode} · projected spend $${decision.projectedSpendUsd.toFixed(2)} · launching 3 agents` });
  const reports = await Promise.all(specs.map((s) => runResearchAgent(s, idea, emit)));

  const { totalSpentUsd, totalSearches, receipts } = tally(reports);
  emit({ type: "spend_update", totalSpentUsd, totalSearches });

  emit({ type: "status", message: "Analyst synthesizing grounded memo..." });
  const memo = await runAnalyst(idea, reports);
  emit({ type: "memo", memo });

  const result: RunResult = { idea, paymentMode: config.paymentMode, reports, memo, totalSpentUsd, totalSearches, receipts };
  emit({ type: "done", result });
  return result;
}
```

- [ ] **Step 2: Write spend.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { tally } from "../src/orchestrator.js";
import type { AgentReport } from "../src/types.js";

const reports: AgentReport[] = [
  { agent: "Market", report: "", searches: [
    { recordId: "market-0", agent: "Market", query: "a", provider: "tavily-x402", paymentMode: "mock", rows: [], costUsd: 0.01, receipt: "0x1" },
    { recordId: "market-1", agent: "Market", query: "b", provider: "tavily-x402", paymentMode: "mock", rows: [], costUsd: 0.01, receipt: "0x2" },
  ]},
  { agent: "Pain", report: "", searches: [
    { recordId: "pain-0", agent: "Pain", query: "c", provider: "tavily-x402", paymentMode: "mock", rows: [], costUsd: 0.01 },
  ]},
];

describe("tally", () => {
  it("sums spend, counts searches, collects present receipts", () => {
    const t = tally(reports);
    expect(t.totalSearches).toBe(3);
    expect(t.totalSpentUsd).toBeCloseTo(0.03, 6);
    expect(t.receipts).toEqual(["0x1", "0x2"]);
  });
});
```

- [ ] **Step 3: Run** — `npm test -- spend`. Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add src/orchestrator.ts test/spend.test.ts
git commit -m "feat: orchestrator with payment mode, SafeSpend pre-flight, parallel agents, tally"
```

---

## Task 11: Server with SSE

**Files:** Create `src/server.ts`

- [ ] **Step 1: Write server.ts**

```ts
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "./config.js";
import { runVentureAnalysis } from "./orchestrator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.static(join(__dirname, "..", "public")));

app.get("/run", async (req, res) => {
  const idea = String(req.query.idea ?? "").trim();
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });

  let terminated = false;
  const send = (event: unknown) => { if (!terminated) res.write(`data: ${JSON.stringify(event)}\n\n`); };
  const end = (event: unknown) => { if (!terminated) { res.write(`data: ${JSON.stringify(event)}\n\n`); terminated = true; res.end(); } };

  if (!idea) return end({ type: "error", message: "Provide an 'idea' query param." });

  try {
    const result = await runVentureAnalysis(idea, (e) => {
      // Guarantee exactly one terminal event: route done/error through end().
      if (e.type === "done" || e.type === "error") end(e); else send(e);
    });
    if (!terminated && result) end({ type: "done", result });
  } catch (err) {
    end({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
});

app.listen(config.port, () => console.log(`Venture Analyst (${config.paymentMode}) at http://localhost:${config.port}`));
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`. Expected: no errors.
- [ ] **Step 3: Run in mock mode (no wallet/key needed for the stream to flow)** — `npm run dev`, open http://localhost:3000, run an idea. Expected: full stream completes with mock receipts.
- [ ] **Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat: express SSE server with single-terminal-event guarantee"
```

---

## Task 12: Frontend (mode badge + citations)

**Files:** Create `public/index.html`

- [ ] **Step 1: Write index.html**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Autonomous Venture Analyst</title>
  <style>
    :root { color-scheme: dark; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 880px; margin: 0 auto; padding: 32px 20px; background: #0b0e14; color: #e6e6e6; }
    h1 { font-size: 1.5rem; margin-bottom: 4px; }
    .sub { color: #8a93a6; margin-top: 0; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: .75rem; font-weight: 700; margin-left: 8px; }
    .badge.mock { background: #3a2f12; color: #fcd34d; } .badge.live { background: #0f3320; color: #6ee7a8; }
    .row { display: flex; gap: 8px; margin: 20px 0; }
    input { flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #2a3140; background: #121722; color: #fff; }
    button { padding: 12px 18px; border: 0; border-radius: 8px; background: #4c8bf5; color: #fff; cursor: pointer; font-weight: 600; }
    button:disabled { opacity: .5; }
    .spend { font-size: 1.1rem; margin: 12px 0; } .spend b { color: #6ee7a8; }
    #log { background: #121722; border: 1px solid #2a3140; border-radius: 10px; padding: 14px; min-height: 60px; font-family: ui-monospace, monospace; font-size: .86rem; white-space: pre-wrap; }
    .line { padding: 2px 0; } .ok { color: #6ee7a8; } .blocked { color: #fca5a5; }
    .agent-Market { color: #7dd3fc; } .agent-Pain { color: #fca5a5; } .agent-Counter { color: #fcd34d; }
    .memo { margin-top: 24px; background: #121722; border: 1px solid #2a3140; border-radius: 10px; padding: 18px; }
    .verdict { font-size: 1.3rem; font-weight: 800; } .PROCEED { color: #6ee7a8; } .KILL { color: #fca5a5; }
    .claim { margin: 10px 0; padding-left: 10px; border-left: 2px solid #2a3140; }
    .cite { font-size: .75rem; color: #8a93a6; } a { color: #7dd3fc; }
  </style>
</head>
<body>
  <h1>Autonomous Venture Analyst <span id="mode" class="badge"></span></h1>
  <p class="sub">Agents research your startup idea and pay for their own searches in USDC (Tavily x402 + Coinbase awal).</p>
  <div class="row">
    <input id="idea" placeholder="e.g. AI startup around pet healthcare" />
    <button id="go">Run analysis</button>
  </div>
  <div class="spend">Spent: <b id="spent">$0.00</b> · Searches: <b id="count">0</b></div>
  <div id="log"></div>
  <div id="memo"></div>
  <script>
    const $ = (id) => document.getElementById(id);
    const money = (n) => "$" + Number(n).toFixed(2);
    const log = (html, cls = "") => { const d = document.createElement("div"); d.className = "line " + cls; d.innerHTML = html; $("log").appendChild(d); $("log").scrollTop = $("log").scrollHeight; };

    $("go").onclick = () => {
      const idea = $("idea").value.trim(); if (!idea) return;
      $("go").disabled = true; $("log").innerHTML = ""; $("memo").innerHTML = "";
      $("spent").textContent = "$0.00"; $("count").textContent = "0";
      const es = new EventSource("/run?idea=" + encodeURIComponent(idea));
      es.onmessage = (m) => {
        const e = JSON.parse(m.data); const a = e.agent ? "agent-" + e.agent : "";
        if (e.type === "run_started") { const b = $("mode"); b.textContent = e.paymentMode === "live" ? "LIVE x402" : "MOCK"; b.className = "badge " + e.paymentMode; log("· run started (cap " + money(e.budgetCapUsd) + ")"); }
        else if (e.type === "status") log("· " + e.message);
        else if (e.type === "agent_start") log("▸ [" + e.agent + "] started", a);
        else if (e.type === "search") log("  [" + e.agent + "] searching: " + e.query, a);
        else if (e.type === "search_done") { const tx = e.receipt ? ' — <a target="_blank" href="https://basescan.org/tx/' + e.receipt + '">receipt</a>' : ""; log("  [" + e.agent + "] ✓ " + e.resultCount + " results · " + money(e.costUsd) + tx, "ok"); }
        else if (e.type === "agent_done") log("✓ [" + e.agent + "] report ready", a);
        else if (e.type === "spend_update") { $("spent").textContent = money(e.totalSpentUsd); $("count").textContent = e.totalSearches; }
        else if (e.type === "policy_blocked") log("⛔ SafeSpend: " + e.reason, "blocked");
        else if (e.type === "memo") renderMemo(e.memo);
        else if (e.type === "done") { es.close(); $("go").disabled = false; renderReceipts(e.result.receipts); }
        else if (e.type === "error") { log("✗ " + e.message, "blocked"); es.close(); $("go").disabled = false; }
      };
      es.onerror = () => { es.close(); $("go").disabled = false; };
    };

    function renderMemo(m) {
      const claims = m.claims.map((c) => {
        const recs = c.recordIds.join(", ");
        const urls = c.sourceUrls.map((u) => '<a target="_blank" href="' + u + '">src</a>').join(" ");
        return '<div class="claim">' + c.claimText + '<div class="cite">records: ' + recs + ' · ' + urls + '</div></div>';
      }).join("");
      $("memo").innerHTML =
        '<div class="memo"><div class="verdict ' + m.recommendation + '">' + m.recommendation + '</div>' +
        '<p>' + m.rationale + '</p><h3>Opportunity</h3><p>' + m.opportunity + '</p>' +
        '<h3>Grounded claims</h3>' + claims + '<div id="receipts"></div></div>';
    }
    function renderReceipts(hashes) {
      if (!hashes || !hashes.length) return;
      const links = hashes.map((h) => '<a target="_blank" href="https://basescan.org/tx/' + h + '">' + h.slice(0, 10) + '…</a>').join(" · ");
      const el = $("receipts"); if (el) el.innerHTML = "<h3>On-chain receipts</h3><span class='cite'>" + links + "</span>";
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: web UI with payment-mode badge, policy events, claim citations, receipts"
```

---

## Task 13: End-to-end + live smoke + README

**Files:** Create `scripts/smoke-search.ts`, `README.md`

- [ ] **Step 1: Full mock run** — `npm run dev` (PAYMENT_MODE=mock), run "AI startup around pet healthcare". Expected: MOCK badge, 6 searches with mock receipts, memo with grounded claims, $0.06 shown — **no real spend**.

- [ ] **Step 2: Write smoke-search.ts (LIVE)**

```ts
// scripts/smoke-search.ts — one REAL paid Tavily search (set PAYMENT_MODE=live)
import { paidSearch } from "../src/tavily.js";
const s = await paidSearch("Market", "pet telehealth", "pet telehealth market size 2026", "smoke-0", 3);
console.log("mode:", s.paymentMode, "rows:", s.rows.length, "cost:", s.costUsd, "receipt:", s.receipt);
console.log("answer:", s.answer?.slice(0, 200));
```

- [ ] **Step 3: Live smoke (requires Task 0 live prereqs; spends ~$0.01)** — `PAYMENT_MODE=live npm run smoke:search`. Expected: rows > 0, a real cost, and a receipt. If receipt is missing it throws (fail-closed) — revisit `extractFromAwalJson` keys against the probe output.

- [ ] **Step 4: Full live run (spends ~$0.06)** — `PAYMENT_MODE=live npm run dev`, run an idea. Expected: LIVE badge, real BaseScan receipts, spend ~$0.06.

- [ ] **Step 5: Write README.md** — pitch, stack, setup (`npm install`, `.env`, mock vs live, awal auth for live), run commands, demo script, honest cost note (~$0.06/live run), and the traceability story (claim → record → source → receipt).

- [ ] **Step 6: Commit**

```bash
git add scripts/smoke-search.ts README.md
git commit -m "docs+test: live smoke script, readme, demo script"
```

---

## Task 14 (STRETCH, optional): Skeptic agent

Only if time remains. A 4th paid agent that runs **after** the first three, sequentially, and only if the remaining budget allows one more call (re-run `checkBatch` with the already-spent total). Gated so it never breaches the budget cap. Adds the "agent adaptively decides to spend more" story. Skip for the core demo.

---

## Self-Review notes (against context.md + ProofSpend adoptions)

- **Spec coverage:** 4 agents (Tasks 8–9), x402 via awal + mock fallback (Tasks 4–5), split-brain LLM (Tasks 3,7,8,9), web UI with mode badge / live log / policy events / claim citations / receipts (Task 12), parallel research (Task 10), honest no-fake-steps. ✓
- **ProofSpend adoptions:** mock-default (Tasks 1,4,5), claim citations (Task 9,12), richer paidSearch + real-price + fail-closed (Task 5), SafeSpend pre-flight (Task 6,10), paymentMode badge + single-terminal-event (Tasks 2,11,12). ✓
- **Known unknown handled:** awal `--json` shape probed empirically (Task 5 Step 3) before the parser is trusted; mock path means this never blocks development. ✓
- **Type consistency:** `PaidSearch` (with `recordId`/`receipt`/`paymentMode`), `MemoClaim`, `Memo.claims`, `RunResult.receipts`, `RunEvent` variants defined in Task 2 and used unchanged downstream. `tally/checkBatch/runVentureAnalysis/runResearchAgent/runAnalyst/paidSearch` signatures consistent across tasks. ✓
- **Cost honesty:** mock spends nothing; live steps (Task 5 Step 3, Task 13 Steps 3–4) flagged with real-money warnings. ✓
- **Citation integrity:** analyst citations validated against the actual evidence catalogue; invented record ids/URLs are dropped (Task 9). ✓
