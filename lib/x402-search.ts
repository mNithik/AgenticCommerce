import { runAwal } from "./awal-cli";
import { config, resolvePaymentMode } from "./config";
import { mockPaidSearch } from "./mock/search-fixtures";
import type { AgentName, PaymentMode, SearchSource } from "./types";

type PaidSearchResult = {
  sources: SearchSource[];
  receipt: string;
  costUsd: number;
  paymentMode: PaymentMode;
  provider: "Tavily x402" | "Tavily x402 (mock)";
};

function findFirstString(
  value: unknown,
  keys: string[],
): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const nested = findFirstString(item, keys);
        if (nested) {
          return nested;
        }
      }
      continue;
    }

    const nested = findFirstString(child, keys);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

function findFirstKeyValue(
  value: unknown,
  predicate: (key: string, candidate: unknown) => boolean,
): unknown {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const [key, candidate] of Object.entries(record)) {
    if (predicate(key, candidate)) {
      return candidate;
    }
  }

  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const nested = findFirstKeyValue(item, predicate);
        if (nested !== undefined) {
          return nested;
        }
      }
      continue;
    }

    const nested = findFirstKeyValue(child, predicate);
    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}

function decodePaymentResponseHeader(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function findFirstNumber(
  value: unknown,
  keys: string[],
): number | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string" && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const nested = findFirstNumber(item, keys);
        if (nested !== undefined) {
          return nested;
        }
      }
      continue;
    }

    const nested = findFirstNumber(child, keys);
    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}

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

  const paymentHeaderValue = findFirstKeyValue(root, (key, candidate) => {
    if (typeof candidate !== "string") {
      return false;
    }

    const normalized = key.toLowerCase();
    return (
      normalized === "payment-response" ||
      normalized === "x-payment-response" ||
      normalized === "payment_response" ||
      normalized === "x_payment_response"
    );
  });

  const paymentHeader = decodePaymentResponseHeader(paymentHeaderValue);

  const receipt =
    findFirstString(paymentHeader ?? root, [
      "transactionHash",
      "txHash",
      "transaction",
      "hash",
      "receipt",
      "receiptHash",
    ]) ?? "";

  const numericAmount = findFirstNumber(paymentHeader ?? root, [
    "amount",
    "value",
    "maxAmountRequired",
    "cost",
  ]) ?? findFirstNumber(root, [
    "amount",
    "value",
    "maxAmountRequired",
    "cost",
  ]);
  const parsedAmount =
    numericAmount !== undefined && Number.isFinite(numericAmount)
      ? numericAmount
      : undefined;
  const costUsd = parsedAmount !== undefined
    ? parsedAmount > 1000
      ? parsedAmount / 1e6
      : parsedAmount
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

  const { stdout } = await runAwal(args, {
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      AGENT_WALLET_KEY: config.agentWalletKey,
    },
  });

  const parsed = parseAwalJson(
    typeof stdout === "string" ? stdout : stdout.toString("utf8"),
  );

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
