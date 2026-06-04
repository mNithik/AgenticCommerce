import { assertRunApiAuthorized } from "../../../../../lib/api-auth";
import { runScheduleNow } from "../../../../../lib/schedules";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = assertRunApiAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }
  const { id } = await context.params;
  const schedule = await runScheduleNow(id);
  if (!schedule) {
    return new Response("Schedule not found.", { status: 404 });
  }
  return Response.json(schedule);
}
