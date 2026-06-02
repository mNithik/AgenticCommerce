# ProofSpend

ProofSpend is a Next.js MVP for receipt-backed autonomous diligence. A user submits a purchase or vendor question, the app runs a small research pipeline, enforces spend policy before every paid search, and returns a memo whose claims map back to evidence records, source URLs, and payment receipts.

## What it does

- runs `Market`, `Evidence`, `Counter`, and optional `Skeptic` research steps
- uses `Tavily x402` as the paid search layer
- supports `mock` mode by default for local work and CI
- supports pluggable LLM providers for summarization and analyst synthesis
- shows a live timeline, spend tracker, memo, and evidence table in one dashboard

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

## SafeSpend guardrails

- blocks over-budget paid calls before payment
- blocks duplicate normalized queries
- blocks duplicate receipts
- caps paid calls at 4 per run
- redacts sensitive fragments from user-visible query previews

## Project structure

```text
app/
  api/run-diligence/route.ts
  layout.tsx
  page.tsx
components/
  AgentTimeline.tsx
  EvidenceTable.tsx
  MemoView.tsx
  ModeBadge.tsx
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
  smoke-llm.mjs
  smoke-search.mjs
test/
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
