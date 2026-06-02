# Context — Autonomous Venture Analyst

## What this is
A hackathon project for the **Agentic Commerce Build Day** (Tavily + Coinbase, Microsoft Garage NYC, June 2 2026).

A **multi-agent system** that takes a startup idea as input and produces a **funded research memo with a go/no-go recommendation** — where the agents autonomously pay for their own web searches in crypto, with no human in the payment loop.

## The core idea / story
> "A founder pays ~$0.08 in USDC and gets back a research memo that would cost a consultant days. The agent funded its own research autonomously — no human card, no API key, no billing account."

The key framing (what makes it more than a Google-Alert clone): **agents that spend money to achieve a business goal**. Every search is a real on-chain micropayment, shown to the user as a receipt at the end.

## The goal (1-day, demo-able)
- Input: a startup idea (e.g. "AI startup around pet healthcare")
- 4 agents run; 3 of them pay-per-search via Tavily x402
- Output: a 1-page venture memo (opportunity, top pain points, top risks, proceed/kill)
- Demo moment: live log of agents searching + running USDC spent + on-chain tx receipts
  ("8 searches, $0.08 spent, here are the BaseScan links")
- Must be **honest** — every agent does something real, no simulated/fake steps.

## The agents
| Agent | Role | Pays for search? |
|-------|------|------------------|
| Orchestrator | Splits idea into research angles, runs agents, tallies spend | No |
| Market Agent | Market size, TAM, competitors, funding | Yes — Tavily x402 |
| Pain Agent | Real user complaints (Reddit, forums, reviews) | Yes — Tavily x402 |
| Counter Agent | Why similar ideas have failed before | Yes — Tavily x402 |
| Analyst Agent | Synthesizes the 3 reports → memo + go/no-go | No (LLM only) |

## The stack (the three required primitives)
- **Coinbase `awal`** — agentic wallet (self-custodied USDC on Base). Handles signing/settlement. The agent's "credit card."
- **Tavily x402** — pay-per-call web search. The agent's "eyes / Google for the LLM."
- **LLM (NVIDIA NIM, free, OpenAI-compatible)** — the agents' "brain."

### Decisions locked in
- **Language/UI:** Node/TypeScript backend + a single web page frontend, live updates via SSE.
- **LLM = split brain** (both via NVIDIA NIM, OpenAI-compatible endpoint `https://integrate.api.nvidia.com/v1`):
  - Research agents (×3): **Llama 3.3 70B** — fast, latency-sensitive, high volume.
  - Analyst agent (×1): a **bigger model (Llama 3.1 405B / DeepSeek-R1)** — reasoning-heavy synthesis.
- **Payments:** shell out to the `awal` CLI (it does NOT expose a raw private key), e.g.:
  ```
  npx awal x402 pay https://x402.tavily.com/search -X POST -d '{"query":"...","max_results":5}' --json
  ```
  awal signs + settles + returns the result and payment proof.

## Hard facts (verified from docs)
- Tavily x402 endpoint: `https://x402.tavily.com/search` (POST, body `{query, ...}`).
- Tavily x402 price: **$0.01 / call**.
- Network: **Base mainnet** (chain `eip155:8453`), asset USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
  → **No testnet.** A full run spends ~$0.06–0.09 of REAL USDC.
- `awal` v2.10.0 installed. `awal x402 pay` flags: `-X` method, `-d` body, `-q` query, `-h` headers, `--max-amount`, `--correlation-id`, `--json`.

## Prerequisites (owner: user)
1. **Authenticate awal + fund wallet** on Base mainnet:
   `npx awal auth login acharya.pre@northeastern.edu` → `npx awal auth verify <flow> <otp>` → `npx awal balance` (fund `npx awal address` if 0).
2. **NVIDIA API key** from build.nvidia.com → put in `.env` as `NVIDIA_API_KEY=nvapi-...`.

## Open questions / known unknowns
- Exact `awal x402 pay --json` output shape (where the API body + tx hash live) — confirm empirically via `npx awal x402 pay --help` / a live test once authenticated.
- Latency of sequential awal payments (each spawns a process + on-chain settle) — mitigate by running the 3 research agents in parallel.
- Open-model JSON/structured-output discipline — add light validation around agent outputs.

## Non-goals (explicitly cut — would be fake in 1 day)
- Buying a domain via x402 (no provider exposes this).
- Real waitlist / signups / interest tracking (no real users in a hackathon).
