import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config, resolvePaymentMode } from "@/lib/config";
import { mockPaidSearch } from "@/lib/mock/search-fixtures";
import type { AgentName, PaymentMode, SearchSource } from "@/lib/types";

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

  // awal returns the settlement proof in the base64 `PAYMENT-RESPONSE` response
  // header (x402 standard), e.g. {"success":true,"transaction":"0x..","network":"eip155:8453"}.
  // Decode that first; fall back to any top-level payment/settlement object.
  const headers = (root.headers as Record<string, unknown> | undefined) ?? {};
  const paymentResponseB64 = String(
    headers["PAYMENT-RESPONSE"] ?? headers["X-PAYMENT-RESPONSE"] ?? "",
  ).trim();

  let headerReceipt = "";
  if (paymentResponseB64) {
    try {
      const decoded = JSON.parse(
        Buffer.from(paymentResponseB64, "base64").toString("utf8"),
      ) as Record<string, unknown>;
      headerReceipt = String(decoded.transaction ?? decoded.txHash ?? "").trim();
    } catch {
      headerReceipt = "";
    }
  }

  const payment =
    (root.payment as Record<string, unknown> | undefined) ??
    (root.settlement as Record<string, unknown> | undefined) ??
    {};

  const receipt =
    headerReceipt ||
    String(
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

  // awal signs with its authenticated CLI session; it inherits process.env.
  // x402 settlement can transiently fail ("authorized but rejected by server");
  // a failed attempt is NOT charged, so retry a couple of times before giving up.
  const maxAttempts = 3;
  let parsed: ReturnType<typeof parseAwalJson> | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { stdout } = await execFileAsync("npx", args, {
        maxBuffer: 10 * 1024 * 1024,
      });
      const jsonStart = stdout.indexOf("{");
      if (jsonStart === -1) {
        throw new Error("awal returned no JSON payload.");
      }
      const candidate = parseAwalJson(stdout.slice(jsonStart));
      if (!candidate.receipt) {
        throw new Error("Live x402 search returned no receipt reference.");
      }
      parsed = candidate;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
  }

  if (!parsed) {
    throw new Error(
      `Live x402 search failed after ${maxAttempts} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
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
