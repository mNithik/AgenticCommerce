import { assertRunApiAuthorized } from "../../../lib/api-auth";
import { applyRateLimit } from "../../../lib/rate-limit";
import { createSchedule, listSchedules } from "../../../lib/schedules";
import type { PolicyProfile } from "../../../lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = assertRunApiAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  return Response.json(listSchedules());
}

export async function POST(request: Request) {
  const unauthorized = assertRunApiAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }
  const rateLimited = applyRateLimit(request, "runDiligence");
  if (rateLimited) {
    return rateLimited;
  }

  let body: {
    label?: unknown;
    question?: unknown;
    budgetCapUsd?: unknown;
    policyProfile?: unknown;
    callbackUrl?: unknown;
    intervalMinutes?: unknown;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const budgetCapUsd =
    typeof body.budgetCapUsd === "number"
      ? body.budgetCapUsd
      : Number(body.budgetCapUsd);
  const intervalMinutes =
    typeof body.intervalMinutes === "number"
      ? body.intervalMinutes
      : Number(body.intervalMinutes);
  const policyProfile =
    body.policyProfile === "strict" || body.policyProfile === "standard"
      ? (body.policyProfile as PolicyProfile)
      : "standard";
  const callbackUrl =
    typeof body.callbackUrl === "string" ? body.callbackUrl.trim() : undefined;

  if (!question) {
    return new Response("question is required.", { status: 400 });
  }
  if (!Number.isFinite(budgetCapUsd) || budgetCapUsd <= 0) {
    return new Response("budgetCapUsd must be a positive number.", { status: 400 });
  }
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 5) {
    return new Response("intervalMinutes must be at least 5.", { status: 400 });
  }
  if (callbackUrl) {
    try {
      const parsed = new URL(callbackUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return new Response("callbackUrl must use http or https.", { status: 400 });
      }
    } catch {
      return new Response("callbackUrl must be a valid URL.", { status: 400 });
    }
  }

  return Response.json(
    createSchedule({
      label,
      question,
      budgetCapUsd,
      policyProfile,
      callbackUrl,
      intervalMinutes,
    }),
  );
}
