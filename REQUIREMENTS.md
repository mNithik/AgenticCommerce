# ProofSpend Requirements

ProofSpend is a Node.js / TypeScript project. It does not use Python dependency management.

## Runtime prerequisites

| Requirement | Version | Needed for |
|---|---|---|
| Node.js | `>=20.9.0` | install, build, run |
| npm | `>=10.0.0` | package management |
| Git | recent | cloning and pushing |

Recommended local version:

- Node `22`

## npm packages

Declared in [`package.json`](./package.json):

### Runtime

- `next`
- `react`
- `react-dom`
- `openai`

### Development

- `typescript`
- `vitest`
- `@playwright/test` for optional browser smoke tests
- `@types/node`
- `@types/react`
- `@types/react-dom`

### Optional Linux / WSL browser dependencies

If you run Playwright inside WSL or Linux, the browser binaries may also require host packages installed through:

```bash
sudo npx playwright install-deps
```

## Environment requirements

See [`.env.example`](./.env.example) for the full template.

### Minimum local config

```env
MOCK_X402=true
LLM_PROVIDER=deterministic
```

### Optional provider keys

- `NVIDIA_API_KEY`
- `OPENAI_API_KEY`
- `HF_TOKEN`

### Live payment config

- `MOCK_X402=false`
- `AGENT_WALLET_KEY=...`

## Install command

```bash
npm install
```

Once a lockfile is committed, fresh machines should use:

```bash
npm ci
```

## Verification commands

```bash
npm run setup:check
npm test
npm run build
```

## Security notes

- never commit `.env`
- keep wallet credentials local
- treat live x402 mode as real-money operation
