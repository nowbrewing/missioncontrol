import { NextResponse } from "next/server";
import { ensureLifeSchema } from "../../../src/db/life";
import { requireSessionUser } from "../../../src/lib/auth";
import {
  DEFAULT_DAILY_DAYS,
  serializeDailyDays,
  type RecurringKind,
} from "../../../src/lib/recurring-week";
import { requireTursoClient } from "../../../src/lib/turso";

const KINDS: RecurringKind[] = ["daily", "count"];

export const GET = async () => {
  try {
    const user = await requireSessionUser();
    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    const result = await turso.execute({
      sql: `SELECT id, title, kind, target_count, daily_days, tally_enabled, pillar_id, milestone_id, spawn_task_cards, active, rank, created_at
            FROM recurring_events WHERE user_id = ? ORDER BY rank ASC, id ASC;`,
      args: [user.id],
    });

    return NextResponse.json({ ok: true, events: result.rows });
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

    const dailyDays =
      kind === "daily" && Array.isArray(body.daily_days) && body.daily_days.length === 7
        ? serializeDailyDays(body.daily_days.map(Boolean) as [
            boolean,
            boolean,
            boolean,
            boolean,
            boolean,
            boolean,
            boolean,
          ])
        : kind === "daily"
          ? serializeDailyDays(DEFAULT_DAILY_DAYS)
          : null;

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    const maxRank = await turso.execute({
      sql: `SELECT COALESCE(MAX(rank), -1) AS max_rank FROM recurring_events WHERE user_id = ?;`,
      args: [user.id],
    });
    const rank = Number((maxRank.rows[0] as Record<string, unknown>).max_rank) + 1;

    const result = await turso.execute({
      sql: `INSERT INTO recurring_events (user_id, title, kind, target_count, daily_days, tally_enabled, pillar_id, milestone_id, spawn_task_cards, rank)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id, title, kind, target_count, daily_days, tally_enabled, pillar_id, milestone_id, spawn_task_cards, active, rank, created_at;`,
      args: [
        user.id,
        title,
        kind,
        targetCount,
        dailyDays,
        tallyEnabled ? 1 : 0,
        body.pillar_id ?? null,
        body.milestone_id ?? null,
        body.spawn_task_cards ? 1 : 0,
        rank,
      ],
    });

    return NextResponse.json({ ok: true, event: result.rows[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Create failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
