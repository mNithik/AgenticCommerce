import { config, resolvePaymentMode, resolvePolicyProfile } from "../../../lib/config";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    app: "ProofSpend",
    paymentMode: resolvePaymentMode(),
    policyProfile: resolvePolicyProfile(),
    llmProvider: config.llmProvider,
    mockX402: config.mockX402,
  });
}
