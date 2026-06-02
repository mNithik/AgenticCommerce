#!/usr/bin/env node
/**
 * Smoke-test configured LLM provider (loads .env via Next-style manual read).
 * Run: npm run smoke:llm
 */
import { readFileSync, existsSync } from "node:fs";
import OpenAI from "openai";

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

const provider = (process.env.LLM_PROVIDER ?? "nvidia").toLowerCase();

let baseURL = "https://integrate.api.nvidia.com/v1";
let apiKey = process.env.NVIDIA_API_KEY;
let model =
  process.env.NVIDIA_MODEL_SUMMARY ?? "meta/llama-3.1-8b-instruct";

if (provider === "openai") {
  baseURL = "https://api.openai.com/v1";
  apiKey = process.env.OPENAI_API_KEY;
  model = process.env.OPENAI_MODEL_SUMMARY ?? "gpt-4o-mini";
} else if (provider === "huggingface") {
  baseURL =
    process.env.HF_BASE_URL ?? "https://router.huggingface.co/v1";
  apiKey = process.env.HF_TOKEN;
  model =
    process.env.HF_MODEL_SUMMARY ?? "meta-llama/Llama-3.1-8B-Instruct";
}

if (!apiKey) {
  console.error(`No API key for LLM_PROVIDER=${provider}`);
  process.exit(1);
}

const client = new OpenAI({ apiKey, baseURL });
const res = await client.chat.completions.create({
  model,
  temperature: 0.2,
  messages: [
    { role: "system", content: "Reply with exactly: OK" },
    { role: "user", content: "ping" },
  ],
  max_tokens: 16,
});

console.log(`[${provider}] model=${model}`);
console.log(res.choices[0]?.message?.content ?? "(empty)");
