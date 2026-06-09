import { NextResponse } from "next/server";
import { ensureLifeSchema } from "../../../../src/db/life";
import { requireSessionUser } from "../../../../src/lib/auth";
import {
  DEFAULT_DAILY_DAYS,
  serializeDailyDays,
  type RecurringKind,
} from "../../../../src/lib/recurring-week";
import { requireTursoClient } from "../../../../src/lib/turso";

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

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    const sets: string[] = [];
    const args: (string | number | null)[] = [];

    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
      }
      sets.push("title = ?");
      args.push(title);
    }
    if (body.kind !== undefined && KINDS.includes(body.kind)) {
      sets.push("kind = ?");
      args.push(body.kind);
    }
    if (body.tally_enabled !== undefined) {
      sets.push("tally_enabled = ?");
      args.push(body.tally_enabled ? 1 : 0);
    }
    if (body.target_count !== undefined) {
      const resolvedKind = body.kind;
      let targetCount = Number(body.target_count);
      if (!Number.isFinite(targetCount)) targetCount = 0;
      if (resolvedKind === "count") {
        if (targetCount < 1) targetCount = 1;
        if (targetCount > 50) targetCount = 50;
      } else {
        if (targetCount < 0) targetCount = 0;
        if (targetCount > 9999) targetCount = 9999;
      }
      sets.push("target_count = ?");
      args.push(targetCount);
    }
    if (body.daily_days !== undefined) {
      const days =
        Array.isArray(body.daily_days) && body.daily_days.length === 7
          ? serializeDailyDays(body.daily_days.map(Boolean) as [
              boolean,
              boolean,
              boolean,
              boolean,
              boolean,
              boolean,
              boolean,
            ])
          : serializeDailyDays(DEFAULT_DAILY_DAYS);
      sets.push("daily_days = ?");
      args.push(days);
    }
    if (body.pillar_id !== undefined) {
      sets.push("pillar_id = ?");
      args.push(body.pillar_id);
    }
    if (body.milestone_id !== undefined) {
      sets.push("milestone_id = ?");
      args.push(body.milestone_id);
    }
    if (body.spawn_task_cards !== undefined) {
      sets.push("spawn_task_cards = ?");
      args.push(body.spawn_task_cards ? 1 : 0);
    }
    if (body.active !== undefined) {
      sets.push("active = ?");
      args.push(body.active ? 1 : 0);
    }

    if (sets.length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }

    args.push(eventId, user.id);
    await turso.execute({
      sql: `UPDATE recurring_events SET ${sets.join(", ")} WHERE id = ? AND user_id = ?;`,
      args,
    });

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

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    await turso.execute({
      sql: `DELETE FROM recurring_events WHERE id = ? AND user_id = ?;`,
      args: [eventId, user.id],
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
