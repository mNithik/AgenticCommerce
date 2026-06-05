# ProofSpend Demo Guide

## Fast demo path

### 1. Safe local demo

Use mock mode with deterministic or NVIDIA summaries:

```env
MOCK_X402=true
LLM_PROVIDER=deterministic
```

Run:

```bash
npm run dev
```

Then in the app:

1. click `Demo run`
2. wait for the memo, receipts, and evidence table
3. point out the live `Proof Score`, confidence breakdown, and raise-confidence card
4. click `Run follow-up` on a paid-search confidence gap to show continuation mode
5. click a memo citation chip
6. export the proof packet
7. copy a signed or digest-attested snapshot link

### 2. Live diligence demo

Use live x402 only on a machine where your wallet setup already works:

```env
MOCK_X402=false
LLM_PROVIDER=nvidia
AGENT_WALLET_KEY=0x...
```

Recommended question:

```text
Should I spend $500 per month on Apollo.io for B2B lead generation for my early-stage SaaS startup?
```

Recommended budget:

```text
0.25
```

What to show:

1. `Live x402` mode badge
2. real receipt hashes in evidence rows
3. SafeSpend policy events
4. final memo claim tracing
5. deterministic confidence + proof score
6. proof packet export
7. continuation follow-up on a confidence gap when the verdict is `need_more_evidence`

## Integration demo

### REST mode

```bash
curl -X POST "http://localhost:3000/api/run-diligence?stream=false" \
  -H "Authorization: Bearer <PROOFSPEND_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Should I buy Apollo.io?",
    "budgetCapUsd": 0.25,
    "policyProfile": "standard",
    "stream": false
  }'
```

Continuation run:

```bash
curl -X POST "http://localhost:3000/api/run-diligence?stream=false" \
  -H "Authorization: Bearer <PROOFSPEND_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Should I buy Apollo.io?",
    "budgetCapUsd": 0.35,
    "policyProfile": "standard",
    "stream": false,
    "parentRunId": "run_abc123",
    "gapId": "gap-counter-deep-dive",
    "suggestedQuery": "Apollo.io lawsuit compliance legal response customer complaints deliverability"
  }'
```

### MCP demo

Initialize:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
```

List tools:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer <PROOFSPEND_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Explain confidence:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer <PROOFSPEND_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"tools/call",
    "params":{
      "name":"proofspend.explain_confidence",
      "arguments":{"run":{"id":"run_123","proofScore":72}}
    }
  }'
```

## Proof / verification demo

1. export a proof packet
2. copy a share link
3. verify with:

```bash
curl -X POST http://localhost:3000/api/verify-proof \
  -H "Content-Type: application/json" \
  -d '{
    "proofPacket": { "...": "packet json here" }
  }'
```

Call out during the demo:

1. `proofScore` is the canonical user-facing score
2. `confidenceBreakdown` explains why the score moved up or down
3. `confidenceGaps` tell the buyer what extra evidence is worth paying for next
4. continuation runs reuse prior receipts instead of restarting diligence from zero

## Final pre-demo checks

```bash
npm test
npm run build
```

Optional:

```bash
npm run smoke:llm
npm run smoke:search
```
