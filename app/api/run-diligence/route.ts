import { runDiligence } from "../../../lib/orchestrator";
import { serializeSSE } from "../../../lib/sse";
import type { RunEvent } from "../../../lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { question?: unknown; budgetCapUsd?: unknown };

  try {
    body = (await request.json()) as { question?: unknown; budgetCapUsd?: unknown };
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const budgetCapUsd = typeof body.budgetCapUsd === "number" ? body.budgetCapUsd : Number(body.budgetCapUsd);

  if (!question) {
    return new Response("Question is required.", { status: 400 });
  }

  if (!Number.isFinite(budgetCapUsd) || budgetCapUsd <= 0) {
    return new Response("budgetCapUsd must be a positive number.", { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: RunEvent) => {
        controller.enqueue(serializeSSE(event));
      };

      try {
        await runDiligence({
          question,
          budgetCapUsd,
          emit,
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
