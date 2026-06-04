import { beforeEach, describe, expect, it, vi } from "vitest";

const listSchedulesMock = vi.fn();
const createScheduleMock = vi.fn();
const toggleScheduleMock = vi.fn();
const deleteScheduleMock = vi.fn();
const runScheduleNowMock = vi.fn();

describe("schedule routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates a schedule", async () => {
    createScheduleMock.mockReturnValue({
      id: "sched_1",
      label: "Apollo schedule",
      question: "Should I buy Apollo.io?",
      budgetCapUsd: 0.25,
      policyProfile: "standard",
      intervalMinutes: 60,
      enabled: true,
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
      nextRunAt: "2026-06-04T01:00:00.000Z",
    });

    vi.doMock("../lib/schedules", () => ({
      listSchedules: listSchedulesMock,
      createSchedule: createScheduleMock,
    }));

    const { POST } = await import("../app/api/schedules/route");
    const response = await POST(
      new Request("http://localhost:3000/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Should I buy Apollo.io?",
          budgetCapUsd: 0.25,
          policyProfile: "standard",
          intervalMinutes: 60,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("sched_1");
  });

  it("lists schedules", async () => {
    listSchedulesMock.mockReturnValue([{ id: "sched_2" }]);
    vi.doMock("../lib/schedules", () => ({
      listSchedules: listSchedulesMock,
      createSchedule: createScheduleMock,
    }));

    const { GET } = await import("../app/api/schedules/route");
    const response = await GET(new Request("http://localhost:3000/api/schedules"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body[0].id).toBe("sched_2");
  });

  it("updates, deletes, and runs schedules", async () => {
    toggleScheduleMock.mockReturnValue({ id: "sched_3", enabled: false });
    deleteScheduleMock.mockReturnValue({ id: "sched_3" });
    runScheduleNowMock.mockResolvedValue({ id: "sched_3", lastStatus: "success" });

    vi.doMock("../lib/schedules", () => ({
      toggleSchedule: toggleScheduleMock,
      deleteSchedule: deleteScheduleMock,
      runScheduleNow: runScheduleNowMock,
    }));

    const idModule = await import("../app/api/schedules/[id]/route");
    const runModule = await import("../app/api/schedules/[id]/run/route");

    const patchResponse = await idModule.PATCH(
      new Request("http://localhost:3000/api/schedules/sched_3", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }),
      { params: Promise.resolve({ id: "sched_3" }) },
    );
    const deleteResponse = await idModule.DELETE(
      new Request("http://localhost:3000/api/schedules/sched_3", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "sched_3" }) },
    );
    const runResponse = await runModule.POST(
      new Request("http://localhost:3000/api/schedules/sched_3/run", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "sched_3" }) },
    );

    expect(patchResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(runResponse.status).toBe(200);
  });
});
