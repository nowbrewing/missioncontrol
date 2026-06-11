import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../src/lib/auth";
import {
  DEFAULT_DAILY_DAYS,
  normalizeRecurringKind,
  type RecurringKind,
} from "../../../../src/lib/recurring-week";
import {
  deleteRoutine,
  updateRoutine,
} from "../../../../src/lib/mongodb/store/routines";

type Params = { params: Promise<{ id: string }> };

const KINDS: RecurringKind[] = ["daily", "count"];

export const PATCH = async (req: Request, { params }: Params) => {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const eventId = Number(id);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const body = (await req.json()) as {
      title?: string;
      kind?: RecurringKind;
      target_count?: number;
      daily_days?: boolean[];
      tally_enabled?: boolean;
      pillar_id?: number | null;
      milestone_id?: number | null;
      spawn_task_cards?: boolean;
      active?: boolean;
    };

    const patch: Partial<{
      title: string;
      kind: RecurringKind;
      targetFrequency: number;
      dailyDays: boolean[];
      tallyEnabled: boolean;
      pillarId: number | null;
      milestoneId: number | null;
      spawnTaskCards: boolean;
      active: boolean;
    }> = {};
    let nextKind: RecurringKind | undefined;
    let nextTallyEnabled: boolean | undefined;

    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
      }
      patch.title = title;
    }
    if (body.kind !== undefined && KINDS.includes(body.kind)) {
      const normalized = normalizeRecurringKind(body.kind, body.tally_enabled ?? false);
      nextKind = normalized.kind;
      nextTallyEnabled = normalized.tally_enabled;
      patch.kind = normalized.kind;
    }
    if (body.tally_enabled !== undefined) {
      const normalized = normalizeRecurringKind(body.kind ?? "daily", body.tally_enabled);
      nextKind = normalized.kind;
      nextTallyEnabled = normalized.tally_enabled;
      patch.tallyEnabled = normalized.tally_enabled;
    }
    if (body.target_count !== undefined) {
      const resolvedKind = nextKind ?? body.kind;
      const resolvedTallyEnabled = nextTallyEnabled ?? body.tally_enabled ?? false;
      let targetCount = Number(body.target_count);
      if (!Number.isFinite(targetCount)) targetCount = 0;
      if (resolvedKind === "count" && !resolvedTallyEnabled) {
        if (targetCount < 1) targetCount = 1;
        if (targetCount > 50) targetCount = 50;
      } else {
        if (targetCount < 0) targetCount = 0;
        if (targetCount > 9999) targetCount = 9999;
      }
      patch.targetFrequency = targetCount;
    }
    if (body.daily_days !== undefined) {
      patch.dailyDays =
        Array.isArray(body.daily_days) && body.daily_days.length === 7
          ? (body.daily_days.map(Boolean) as boolean[])
          : DEFAULT_DAILY_DAYS;
    }
    if (body.pillar_id !== undefined) {
      patch.pillarId = body.pillar_id;
    }
    if (body.milestone_id !== undefined) {
      patch.milestoneId = body.milestone_id;
    }
    if (body.spawn_task_cards !== undefined) {
      patch.spawnTaskCards = !!body.spawn_task_cards;
    }
    if (body.active !== undefined) {
      patch.active = !!body.active;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }

    await updateRoutine(user.id, eventId, patch);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Update failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};

export const DELETE = async (_req: Request, { params }: Params) => {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const eventId = Number(id);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    await deleteRoutine(user.id, eventId);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
