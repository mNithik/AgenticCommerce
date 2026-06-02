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

### `GET /api/health`

Returns a small JSON health payload with the active payment mode, policy profile, and configured LLM provider.

## Demo flow

1. Start in mock mode to verify the UI and export flow.
2. Switch to live mode in WSL if your Windows `awal` bridge is unreliable.
3. Run the Apollo.io example question.
4. Click a memo claim to trace it to the evidence row and receipt.
5. Export the proof packet in Markdown or JSON.

## Project structure

```text
app/
  api/run-diligence/route.ts
  layout.tsx
  page.tsx
components/
  AgentTimeline.tsx
  EvidenceTable.tsx
  ExportProofPacket.tsx
  MemoView.tsx
  MockWatermark.tsx
  ModeBadge.tsx
  RunHistory.tsx
  SafeSpendPanel.tsx
  RunForm.tsx
  SpendTracker.tsx
lib/
  agents/
  llm/
  mock/
  config.ts
  orchestrator.ts
  safespend.ts
  sse.ts
  subject.ts
  types.ts
  x402-search.ts
scripts/
  check-prerequisites.mjs
  probe-awal.mjs
  smoke-llm.mjs
  smoke-search.mjs
test/
  proof-packet.test.ts
  safespend.test.ts
```

## Publishing checklist

Before pushing this repo to GitHub:

1. Run `npm install`
2. Run `npm test`
3. Run `npm run build`
4. Make sure `.env` is not committed
5. Keep live wallet credentials only on your local machine

## More docs

- [SETUP.md](./SETUP.md)
- [REQUIREMENTS.md](./REQUIREMENTS.md)
