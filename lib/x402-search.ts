import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config, resolvePaymentMode } from "./config";
import { mockPaidSearch } from "./mock/search-fixtures";
import type { AgentName, PaymentMode, SearchSource } from "./types";

const execFileAsync = promisify(execFile);

type PaidSearchResult = {
  sources: SearchSource[];
  receipt: string;
  costUsd: number;
  paymentMode: PaymentMode;
  provider: "Tavily x402" | "Tavily x402 (mock)";
};

function parseAwalJson(raw: string) {
  const root = JSON.parse(raw) as Record<string, unknown>;
  const bodyCandidates = [
    root.body,
    root.data,
    root.response,
    root.result,
    root,
  ] as Array<Record<string, unknown> | undefined>;

  const body =
    bodyCandidates.find((candidate) => {
      const results = candidate?.results;
      return Array.isArray(results);
    }) ?? {};

  const results = Array.isArray((body as { results?: unknown[] }).results)
    ? ((body as { results: Array<Record<string, unknown>> }).results ?? []).map((item) => ({
        title: String(item.title ?? "Untitled source"),
        url: String(item.url ?? ""),
        snippet: String(item.content ?? item.raw_content ?? item.snippet ?? ""),
      }))
    : [];

  const payment =
    (root.payment as Record<string, unknown> | undefined) ??
    (root.settlement as Record<string, unknown> | undefined) ??
    {};

  const receipt = String(
    payment.transactionHash ??
      payment.txHash ??
      payment.transaction ??
      payment.hash ??
      "",
  ).trim();

  const amountRaw = payment.amount ?? payment.value;
  const numericAmount =
    typeof amountRaw === "number"
      ? amountRaw
      : typeof amountRaw === "string"
        ? Number(amountRaw)
        : Number.NaN;
  const costUsd = Number.isFinite(numericAmount)
    ? numericAmount > 1000
      ? numericAmount / 1e6
      : numericAmount
    : 0.01;

  return {
    results,
    receipt,
    costUsd,
  };
}

async function livePaidSearch(params: {
  query: string;
  maxResults: number;
}): Promise<PaidSearchResult> {
  const body = JSON.stringify({
    query: params.query,
    max_results: params.maxResults,
    include_answer: false,
  });

  const args = [
    "-y",
    "awal",
    "x402",
    "pay",
    config.tavilyX402Url,
    "-X",
    "POST",
    "-d",
    body,
    "--max-amount",
    config.awalMaxAmount,
    "--json",
  ];

  const { stdout } = await execFileAsync("npx", args, {
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      AGENT_WALLET_KEY: config.agentWalletKey,
    },
  });

  const parsed = parseAwalJson(stdout);

  if (!parsed.receipt) {
    throw new Error("Live x402 search returned no receipt reference.");
  }

  return {
    sources: parsed.results,
    receipt: parsed.receipt,
    costUsd: parsed.costUsd || 0.01,
    paymentMode: "live",
    provider: "Tavily x402",
  };
}

export async function paidSearch(params: {
  agent: AgentName;
  query: string;
  runId: string;
  callIndex: number;
  subject: string;
  maxResults?: number;
}) {
  if (resolvePaymentMode() === "mock") {
    return mockPaidSearch({
      agent: params.agent,
      query: params.query,
      runId: params.runId,
      callIndex: params.callIndex,
      subject: params.subject,
    });
  }

  return livePaidSearch({
    query: params.query,
    maxResults: params.maxResults ?? 5,
  });
}
