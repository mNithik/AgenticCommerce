# ProofSpend Release Checklist

Use this checklist before pushing a polished release checkpoint.

## 1. Environment sanity

- confirm `.env` is local-only and not staged
- confirm the intended mode for demos:
  - `MOCK_X402=true` for safe demo mode
  - `MOCK_X402=false` only on a machine with working wallet setup
- if running from WSL, make sure Playwright host dependencies are installed:

```bash
sudo npx playwright install-deps
npx playwright install
```

## 2. Verification

Run the full local verification stack:

```bash
npm install
npm run setup:check
npm test
npm run build
npm run test:e2e
```

Optional live-path checks:

```bash
npm run smoke:llm
npm run smoke:search
```

## 3. Product sanity checks

- run one mock demo flow
- run one live flow if wallet/live mode is enabled
- click a memo citation chip and confirm evidence scroll linkage
- export both proof packet formats
- copy a share link and reopen the snapshot
- verify `/api/openapi` loads
- verify one MCP call if this release is agent-facing

## 4. Docs sanity checks

- [README.md](C:\Users\nithi\OneDrive\Documents\MICROSOFTTECHWEEK\README.md) matches the current scripts and routes
- [SETUP.md](C:\Users\nithi\OneDrive\Documents\MICROSOFTTECHWEEK\SETUP.md) matches the current install path
- [DEMO.md](C:\Users\nithi\OneDrive\Documents\MICROSOFTTECHWEEK\DEMO.md) matches the current UI flow
- [REQUIREMENTS.md](C:\Users\nithi\OneDrive\Documents\MICROSOFTTECHWEEK\REQUIREMENTS.md) matches the current runtime and Playwright setup

## 5. Git hygiene

- review `git status`
- make sure generated Playwright artifacts are not staged:
  - `test-results/`
  - `playwright-report/`
- keep wallet credentials and secrets out of commits

## 6. Release checkpoint

Good release checkpoint language:

- `feat: complete trust and platform release prep`
- `feat: ship api, proof, mcp, and observability stack`

If the repo passes the checks above, it is ready for a push and release-style checkpoint.
