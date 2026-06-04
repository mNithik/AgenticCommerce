# ProofSpend Setup

## Clone or open the repo

If this is a new machine:

```bash
git clone <your-repo-url> proofspend
cd proofspend
```

If you already have the folder, just open it and continue below.

## Node and npm

Recommended:

- Node `22`
- npm `10+`

This repo includes `.nvmrc`, so on systems with `nvm` you can run:

```bash
nvm install
nvm use
```

## Install dependencies

```bash
npm install
```

If a `package-lock.json` is committed later, prefer:

```bash
npm ci
```

## Create `.env`

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

For the easiest first run:

```env
MOCK_X402=true
LLM_PROVIDER=deterministic
```

That path requires no wallet and no API keys.

## Verify setup

```bash
npm run setup:check
```

This checks the local environment and gives you quick feedback before you start the app.

## Run locally

```bash
npm run dev
```

Open:

- [http://localhost:3000](http://localhost:3000)

## Optional: enable an LLM provider

### NVIDIA

```env
LLM_PROVIDER=nvidia
NVIDIA_API_KEY=nvapi-...
```

### OpenAI

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### Hugging Face

```env
LLM_PROVIDER=huggingface
HF_TOKEN=hf_...
```

Then verify:

```bash
npm run smoke:llm
```

## Optional: enable live x402 mode

Only do this on a machine where you control the wallet.

```env
MOCK_X402=false
AGENT_WALLET_KEY=0x...
```

Then verify the live payment path:

```bash
npm run smoke:search
```

## Recommended pre-push checks

```bash
npm test
npm run build
```

Optional after installing `@playwright/test`:

```bash
npm run test:e2e
```

If you are using WSL and Playwright reports missing browser libraries, run:

```bash
sudo npx playwright install-deps
npx playwright install
npm run test:e2e
```

## Common issues

### `npm install` fails

- verify Node is current enough
- retry with a clean network connection
- remove any partial `node_modules` if the install was interrupted

### Live mode fails immediately

- confirm `MOCK_X402=false`
- confirm `AGENT_WALLET_KEY` is set locally
- switch back to `MOCK_X402=true` for UI-only work

### LLM summaries are deterministic instead of model-generated

- check that your selected provider key is present in `.env`
- run `npm run smoke:llm`

### Playwright installs browsers but still cannot launch them in WSL

- this usually means the Linux host libraries are missing, not the browser download itself
- run `sudo npx playwright install-deps`
- then rerun `npx playwright install`
