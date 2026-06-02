#!/usr/bin/env node
/**
 * Quick prerequisite check for a new machine.
 * Usage: node scripts/check-prerequisites.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const ok = (msg) => console.log(`  OK  ${msg}`);
const warn = (msg) => console.log(`  WARN ${msg}`);
const fail = (msg) => console.log(`  FAIL ${msg}`);

let errors = 0;

console.log("\nProofSpend setup check\n");

// Node version
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 20) {
  ok(`Node ${process.versions.node} (need >= 20.9, recommend 22)`);
} else {
  fail(`Node ${process.versions.node} — upgrade to Node 20+`);
  errors++;
}

// package-lock
if (existsSync("package-lock.json")) {
  ok("package-lock.json present (use npm ci on this machine)");
} else {
  warn("package-lock.json missing — run npm install and commit the lockfile");
}

// node_modules
if (existsSync("node_modules")) {
  ok("node_modules installed");
} else {
  fail("node_modules missing — run: npm ci");
  errors++;
}

// .env
if (existsSync(".env")) {
  ok(".env exists");
  const envText = readFileSync(".env", "utf8");
  const mock = /MOCK_X402\s*=\s*false/i.test(envText);
  if (mock) {
    warn("MOCK_X402=false — live mode needs wallet + USDC");
    if (!/AGENT_WALLET_KEY\s*=\s*0x/i.test(envText)) {
      warn("AGENT_WALLET_KEY not set — required for live x402");
    }
  } else {
    ok("MOCK_X402=true (or unset) — mock mode friendly");
  }
  const provider = envText.match(/LLM_PROVIDER\s*=\s*(\w+)/i)?.[1]?.toLowerCase();
  if (provider === "nvidia" && !/NVIDIA_API_KEY\s*=\s*\S+/i.test(envText)) {
    warn("LLM_PROVIDER=nvidia but NVIDIA_API_KEY empty — will fall back to deterministic");
  }
} else {
  warn(".env missing — copy .env.example to .env");
}

// awal (optional)
try {
  const { stdout } = await exec("npx", ["-y", "awal@2.10.0", "status"], {
    timeout: 60_000,
  });
  if (/authenticated|signed in/i.test(stdout)) {
    ok("awal authenticated (live x402 ready)");
  } else {
    warn("awal reachable but not authenticated — run: npx awal@2.10.0 auth login");
  }
} catch {
  warn("awal check skipped (network or first-time npx download)");
}

console.log(
  errors
    ? `\n${errors} blocking issue(s). See SETUP.md\n`
    : "\nReady to run: npm run dev\n",
);
process.exit(errors > 0 ? 1 : 0);
