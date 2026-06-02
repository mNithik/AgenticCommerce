#!/usr/bin/env node
/**
 * One live Tavily x402 search via awal (~$0.01 USDC). Requires MOCK_X402=false and auth.
 * Run: npm run smoke:search
 */
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

loadEnv();

if (process.env.MOCK_X402 !== "false") {
  console.error("Set MOCK_X402=false in .env for a real paid search.");
  process.exit(1);
}

const url =
  process.env.TAVILY_X402_URL ?? "https://x402.tavily.com/search";
const maxAmount = process.env.AWAL_MAX_AMOUNT ?? "20000";
const body = JSON.stringify({
  query: "proofspend smoke test market size",
  max_results: 3,
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

console.log(stdout);
function awalExec(commandArgs) {
  if (process.platform === "win32") {
    return exec("cmd.exe", ["/d", "/s", "/c", "npx", ...commandArgs], {
      maxBuffer: 10 * 1024 * 1024,
    });
  }

  return exec("npx", commandArgs, { maxBuffer: 10 * 1024 * 1024 });
}
