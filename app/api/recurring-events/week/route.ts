import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../src/lib/auth";
import {
  ensureRecurringWeek,
  updateRecurringProgress,
} from "../../../../src/lib/recurring-events";
import type { RecurringProgress } from "../../../../src/lib/recurring-week";

export const GET = async () => {
  try {
    const user = await requireSessionUser();
    const data = await ensureRecurringWeek(user.id);
    return NextResponse.json({ ok: true, ...data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Load failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};

export const PATCH = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as {
      progress_id?: number;
      event_id?: number;
      kind?: string;
      target_count?: number;
      week_monday?: string;
      spawn_task_cards?: boolean;
      tally_enabled?: boolean;
      progress?: RecurringProgress;
    };

    const progressId = Number(body.progress_id);
    const eventId = Number(body.event_id);
    if (!Number.isFinite(progressId) || !Number.isFinite(eventId) || !body.progress) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const kind = body.kind as "daily" | "count";
    if (kind !== "daily" && kind !== "count") {
      return NextResponse.json({ ok: false, error: "Invalid kind" }, { status: 400 });
    }

    await updateRecurringProgress(
      user.id,
      progressId,
      body.progress,
      kind,
      Number(body.target_count) || 1,
      eventId,
      body.week_monday || "",
      !!body.spawn_task_cards,
      !!body.tally_enabled
    );

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Update failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
