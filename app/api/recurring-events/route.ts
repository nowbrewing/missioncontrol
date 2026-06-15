import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../src/lib/auth";
import {
  DEFAULT_DAILY_DAYS,
  type RecurringKind,
} from "../../../src/lib/recurring-week";
import {
  getMaxRoutineRank,
  insertRoutine,
  listAllRoutines,
} from "../../../src/lib/mongodb/store/routines";

const KINDS: RecurringKind[] = ["daily", "count"];

export const GET = async () => {
  try {
    const user = await requireSessionUser();
    const events = await listAllRoutines(user.id);
    return NextResponse.json({ ok: true, events });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Load failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};

export const POST = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as {
      title?: string;
      kind?: RecurringKind;
      target_count?: number;
      daily_days?: boolean[];
      tally_enabled?: boolean;
      pillar_id?: number | null;
      milestone_id?: number | null;
      spawn_task_cards?: boolean;
      rules?: string | null;
    };

    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
    }

    const kind = body.kind && KINDS.includes(body.kind) ? body.kind : "daily";
    const tallyEnabled = kind === "daily" && !!body.tally_enabled;

    let targetCount = Number(body.target_count);
    if (kind === "count") {
      targetCount = Number.isFinite(targetCount) && targetCount >= 1 ? targetCount : 1;
      if (targetCount > 50) targetCount = 50;
    } else if (tallyEnabled) {
      targetCount = Number.isFinite(targetCount) && targetCount >= 0 ? targetCount : 0;
      if (targetCount > 9999) targetCount = 9999;
    } else {
      targetCount = 0;
    }

    const resolvedDailyDays =
      kind === "daily" && Array.isArray(body.daily_days) && body.daily_days.length === 7
        ? (body.daily_days.map(Boolean) as [
            boolean,
            boolean,
            boolean,
            boolean,
            boolean,
            boolean,
            boolean,
          ])
        : DEFAULT_DAILY_DAYS;

    const rank = (await getMaxRoutineRank(user.id)) + 1;

    const event = await insertRoutine(user.id, {
      title,
      kind,
      targetCount,
      dailyDays: resolvedDailyDays,
      tallyEnabled,
      pillarId: body.pillar_id ?? null,
      milestoneId: body.milestone_id ?? null,
      spawnTaskCards: !!body.spawn_task_cards,
      rank,
      rules: body.rules?.trim() || null,
    });

    return NextResponse.json({ ok: true, event });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Create failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
