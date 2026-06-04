import { assertRunApiAuthorized } from "../../../lib/api-auth";
import { applyRateLimit } from "../../../lib/rate-limit";
import { executeRun } from "../../../lib/run-service";
import { serializeSSE } from "../../../lib/sse";
import type { PolicyProfile, RunEvent } from "../../../lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = assertRunApiAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }
  const rateLimited = applyRateLimit(request, "runDiligence");
  if (rateLimited) {
    return rateLimited;
  }

  const url = new URL(request.url);
  let body: {
    question?: unknown;
    budgetCapUsd?: unknown;
    callbackUrl?: unknown;
    policyProfile?: unknown;
    stream?: unknown;
  };

  try {
    body = (await request.json()) as { question?: unknown; budgetCapUsd?: unknown };
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const budgetCapUsd = typeof body.budgetCapUsd === "number" ? body.budgetCapUsd : Number(body.budgetCapUsd);
  const callbackUrl = typeof body.callbackUrl === "string" ? body.callbackUrl.trim() : "";
  const stream =
    body.stream === false || url.searchParams.get("stream") === "false"
      ? false
      : true;
  const policyProfile =
    body.policyProfile === "strict" || body.policyProfile === "standard"
      ? (body.policyProfile as PolicyProfile)
      : undefined;

  if (!question) {
    return new Response("Question is required.", { status: 400 });
  }

  if (!Number.isFinite(budgetCapUsd) || budgetCapUsd <= 0) {
    return new Response("budgetCapUsd must be a positive number.", { status: 400 });
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

  if (!stream) {
    try {
      const run = await executeRun({
        question,
        budgetCapUsd,
        policyProfile,
        callbackUrl,
      });
      return Response.json(run);
    } catch (error) {
      return new Response(
        error instanceof Error ? error.message : "Unknown run error.",
        { status: 500 },
      );
    }
  }

  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: RunEvent) => {
        controller.enqueue(serializeSSE(event));
      };

      try {
        const run = await executeRun({
          question,
          budgetCapUsd,
          policyProfile,
          emit,
          callbackUrl,
        });

        emit({
          type: "complete",
          run,
        });
      } catch (error) {
        emit({
          type: "run_error",
          message: error instanceof Error ? error.message : "Unknown run error.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
