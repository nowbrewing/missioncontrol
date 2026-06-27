import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../../../src/lib/date";
import { regenerateHabitCalendarTasks } from "../../../../../src/lib/recurring-events";
import { findRoutine } from "../../../../../src/lib/mongodb/store/routines";

type Params = { params: Promise<{ id: string }> };

export const POST = async (req: Request, { params }: Params) => {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const eventId = Number(id);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const body = (await req.json()) as { from_date?: string };
    const fromDate = body.from_date?.trim() || todayIsoYyyyMmDd();
    if (!isYyyyMmDd(fromDate)) {
      return NextResponse.json({ ok: false, error: "Invalid from_date" }, { status: 400 });
    }

    const routine = await findRoutine(user.id, eventId);
    if (!routine) {
      return NextResponse.json({ ok: false, error: "Habit not found" }, { status: 404 });
    }
    if (!routine.spawnTaskCards) {
      return NextResponse.json(
        { ok: false, error: "Calendar tasks are not enabled for this habit" },
        { status: 400 }
      );
    }

    await regenerateHabitCalendarTasks(user.id, eventId, fromDate);

    return NextResponse.json({ ok: true, from_date: fromDate });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Regenerate failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
