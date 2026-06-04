import { assertRunApiAuthorized } from "../../../../lib/api-auth";
import { deleteSchedule, toggleSchedule } from "../../../../lib/schedules";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = assertRunApiAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }
  const { id } = await context.params;
  const removed = deleteSchedule(id);
  if (!removed) {
    return new Response("Schedule not found.", { status: 404 });
  }
  return Response.json(removed);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = assertRunApiAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }
  const { id } = await context.params;
  let body: { enabled?: unknown };
  try {
    body = (await request.json()) as { enabled?: unknown };
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return new Response("enabled must be a boolean.", { status: 400 });
  }

  const updated = toggleSchedule(id, body.enabled);
  if (!updated) {
    return new Response("Schedule not found.", { status: 404 });
  }

  return Response.json(updated);
}
