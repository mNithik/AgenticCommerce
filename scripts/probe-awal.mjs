#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

function loadEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}

function decodePaymentHeader(raw) {
  if (!raw || typeof raw !== "string") {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function findFirstHeader(value) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  for (const [key, candidate] of Object.entries(value)) {
    if (
      typeof candidate === "string" &&
      ["payment-response", "x-payment-response", "payment_response", "x_payment_response"].includes(
        key.toLowerCase(),
      )
    ) {
      return candidate;
    }
  }

  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const nested = findFirstHeader(item);
        if (nested) {
          return nested;
        }
      }
      continue;
    }

    const nested = findFirstHeader(child);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

function awalExec(commandArgs) {
  if (process.platform === "win32") {
    return exec("cmd.exe", ["/d", "/s", "/c", "npx", ...commandArgs], {
      maxBuffer: 10 * 1024 * 1024,
    });
  }

  return exec("npx", commandArgs, { maxBuffer: 10 * 1024 * 1024 });
}

loadEnv();

if (process.env.MOCK_X402 !== "false") {
  console.error("Set MOCK_X402=false in .env before probing awal.");
  process.exit(1);
}

const url = process.env.TAVILY_X402_URL ?? "https://x402.tavily.com/search";
const maxAmount = process.env.AWAL_MAX_AMOUNT ?? "20000";
const body = JSON.stringify({
  query: "proofspend receipt probe",
  max_results: 1,
});

const { stdout } = await awalExec([
  "-y",
  "awal@2.10.0",
  "x402",
  "pay",
  url,
  "-X",
  "POST",
  "-d",
  body,
  "--max-amount",
  maxAmount,
  "--json",
]);

const parsed = JSON.parse(stdout);
const paymentHeader = decodePaymentHeader(findFirstHeader(parsed));

console.log(
  JSON.stringify(
    {
      paymentHeader,
      rawTopLevelKeys: Object.keys(parsed),
    },
    null,
    2,
  ),
);
