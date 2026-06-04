# ProofSpend

ProofSpend is a Next.js MVP for receipt-backed autonomous diligence. A user submits a purchase or vendor question, the app runs a small research pipeline, enforces spend policy before every paid search, and returns a memo whose claims map back to evidence records, source URLs, and payment receipts.

## What it does

- runs `Market`, `Evidence`, `Counter`, and optional `Skeptic` research steps
- uses `Tavily x402` as the paid search layer
- supports `mock` mode by default for local work and CI
- supports pluggable LLM providers for summarization and analyst synthesis
- shows a live timeline, spend tracker, memo, and evidence table in one dashboard
- exports completed runs as proof packets in JSON or Markdown
- stores the last 10 completed runs locally for quick reopen
- lets you click memo claims to trace them back to evidence rows and receipts
- creates shareable snapshot links for completed runs
- compares two vendor diligence runs side by side
- includes an in-app API guide for agent and webhook integrations

## Modes

### Mock mode

Default mode:

```env
MOCK_X402=true
```

- no wallet required
- no API key required
- deterministic local fallback is available even if no LLM provider is configured
- receipts are synthetic and clearly marked as simulated

### Live mode

```env
MOCK_X402=false
```

- uses real Tavily x402 paid calls
- requires local wallet/payment setup
- requires a valid `AGENT_WALLET_KEY`
- fails closed if a paid call cannot return a usable receipt reference

This app is designed for local/private demo use, not public multi-user deployment.

## LLM providers

Set `LLM_PROVIDER` to one of:

- `nvidia`
- `openai`
- `huggingface`
- `deterministic`

If the selected provider is not configured, ProofSpend falls back to deterministic subject extraction, summarization, and memo synthesis.

## Tech stack

- Next.js 15
- React 19
- TypeScript
- Vitest
- OpenAI-compatible SDK integration for NVIDIA / OpenAI / Hugging Face endpoints

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Create your environment file

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

For the safest first run, keep:

```env
MOCK_X402=true
LLM_PROVIDER=deterministic
```

### 3. Verify local setup

```bash
npm run setup:check
```

### 4. Start the app

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Environment variables

See [`.env.example`](./.env.example) for the full list.

Most important values:

- `MOCK_X402`
- `AGENT_WALLET_KEY`
- `LLM_PROVIDER`
- `POLICY_PROFILE`
- `DEFAULT_PAID_CALL_COST_USD`
- `PROOFSPEND_API_KEY`
- `PROOFSPEND_SIGNING_SECRET`
- `WEBHOOK_SECRET`
- `WEBHOOK_MAX_ATTEMPTS`
- `NVIDIA_API_KEY`
- `OPENAI_API_KEY`
- `HF_TOKEN`

## Available scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local Next.js dev server |
| `npm run build` | Build the production app |
| `npm run start` | Run the production build |
| `npm run test` | Run unit tests |
| `npm run setup:check` | Validate local prerequisites and env basics |
| `npm run smoke:llm` | Check the active LLM provider setup |
| `npm run smoke:search` | Exercise one live paid search path |
| `npm run probe:awal` | Inspect raw live awal payment headers for receipt debugging |
| `npm run test:e2e` | Run Playwright smoke tests after installing `@playwright/test` locally |

## SafeSpend guardrails

- blocks sensitive queries that contain likely PII before payment
- batch-checks the planned primary run before the first paid call
- blocks over-budget paid calls before payment
- blocks duplicate normalized queries
- blocks duplicate receipts
- caps paid calls at 4 per run
- redacts sensitive fragments from user-visible query previews

## API surface

### `POST /api/run-diligence`

Request body:

```json
{
  "question": "Should I spend $500 per month on Apollo.io for B2B lead generation for my early-stage SaaS startup?",
  "budgetCapUsd": 0.25,
  "policyProfile": "standard",
  "callbackUrl": "https://example.com/webhook"
}
```

Notes:

- response is `text/event-stream`
- `policyProfile` supports `standard` and `strict`
- `callbackUrl` is optional and receives the final `DiligenceRun` JSON as a best-effort POST after completion
- add `?stream=false` or body `"stream": false` to receive the final `DiligenceRun` JSON directly instead of SSE
- when `WEBHOOK_SECRET` is set, callback deliveries include `X-ProofSpend-Timestamp` and `X-ProofSpend-Signature`
- when `PROOFSPEND_API_KEY` is set, callers must send `Authorization: Bearer <key>`

### `GET /api/health`

Returns a small JSON health payload with the active payment mode, policy profile, and configured LLM provider. This route stays open even when `PROOFSPEND_API_KEY` is configured so the local dashboard status strip can still load without extra client auth wiring.

The payload also includes lightweight operational diagnostics:
- process uptime
- current in-memory rate-limit settings
- recent webhook delivery outcomes

### `GET /api/openapi`

Returns the current OpenAPI JSON document for the ProofSpend API.

### `POST /api/mcp`

ProofSpend also exposes a lightweight MCP-style JSON-RPC endpoint for agent integrations. Supported methods include:

- `initialize`
- `ping`
- `tools/list`
- `tools/call`
- `resources/list`
- `resources/read`

Current MCP tools:

- `proofspend.run_diligence`
- `proofspend.verify_proof`
- `proofspend.get_health`
- `proofspend.get_openapi`

Current MCP resources:

- `proofspend://health`
- `proofspend://openapi`
- `proofspend://runs/recent`

When `PROOFSPEND_API_KEY` is configured, MCP `tools/call` and `resources/read` requests must send the same `Authorization: Bearer <key>` header as the HTTP API.

### `POST /api/sign-snapshot`

Accepts a completed `DiligenceRun` and returns an encoded snapshot plus its attestation. When `PROOFSPEND_SIGNING_SECRET` is configured, the attestation is server-signed with HMAC-SHA256; otherwise it falls back to a digest-only attestation.

### `POST /api/verify-proof`

Accepts either a `snapshot` string, a `proofPacket` JSON object, or a `run` plus `attestation`, then returns a verification result showing whether the digest and optional signature still match.

## Platform hardening notes

- `POST /api/run-diligence`, `POST /api/sign-snapshot`, and `POST /api/verify-proof` are protected by simple in-memory rate limits.
- completed runs can now carry `webhookDelivery` metadata when a callback was attempted
- the dashboard surfaces recent webhook outcomes in local history and health diagnostics

### Scheduling and observability

- `GET /api/schedules` and `POST /api/schedules` manage in-memory recurring diligence templates
- `PATCH` / `DELETE /api/schedules/:id` update or remove a schedule
- `POST /api/schedules/:id/run` dispatches a saved schedule immediately
- `POST /api/webhooks/retry` retries a recent webhook delivery by `deliveryId`
- `GET /api/observability` returns recent run, webhook, schedule, verify, and MCP events

### Playwright smoke scaffold

This repo now includes a Playwright-ready smoke scaffold:

- `playwright.config.mjs`
- `e2e/proofspend.smoke.spec.mjs`

Install `@playwright/test` in your local environment before running:

```bash
npm run test:e2e
```

If you are running in WSL and `npx playwright install` warns that the host is missing browser dependencies, install the Linux packages first:

```bash
sudo npx playwright install-deps
npx playwright install
```

Then rerun:

```bash
npm run test:e2e
```

## Demo flow

1. Start in mock mode to verify the UI and export flow.
2. Switch to live mode in WSL if your Windows `awal` bridge is unreliable.
3. Run the Apollo.io example question.
4. Click a memo claim to trace it to the evidence row and receipt.
5. Export the proof packet in Markdown or JSON.
6. Copy a share link or compare the run against another saved vendor.

## Project structure

```text
app/
  api/health/route.ts
  api/mcp/route.ts
  api/observability/route.ts
  api/openapi/route.ts
  api/run-diligence/route.ts
  api/schedules/route.ts
  api/sign-snapshot/route.ts
  api/verify-proof/route.ts
  api/webhooks/retry/route.ts
  layout.tsx
  page.tsx
components/
  RunForm.tsx
  proofspend/Dashboard.tsx
  ui/*
lib/
  agents/
  llm/
  mock/
  api-auth.ts
  config.ts
  health.ts
  observability.ts
  openapi.ts
  orchestrator.ts
  proof-packet.ts
  rate-limit.ts
  recent-runs.ts
  run-sharing.ts
  run-service.ts
  safespend.ts
  schedules.ts
  sse.ts
  subject.ts
  trust.ts
  types.ts
  webhooks.ts
  x402-search.ts
scripts/
  check-prerequisites.mjs
  probe-awal.mjs
  smoke-llm.mjs
  smoke-search.mjs
e2e/
  proofspend.smoke.spec.mjs
test/
  *.test.ts
```

## Publishing checklist

Before pushing this repo to GitHub:

1. Run `npm install`
2. Run `npm test`
3. Run `npm run build`
4. Make sure `.env` is not committed
5. Keep live wallet credentials only on your local machine

For the fuller release-prep flow, use [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).

## More docs

- [SETUP.md](./SETUP.md)
- [REQUIREMENTS.md](./REQUIREMENTS.md)
- [DEMO.md](./DEMO.md)
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
