import { NextResponse } from "next/server";
import { ensureLifeSchema } from "../../../src/db/life";
import { requireSessionUser } from "../../../src/lib/auth";
import { isYyyyMmDd } from "../../../src/lib/date";
import { requireTursoClient } from "../../../src/lib/turso";

export const GET = async () => {
  try {
    const user = await requireSessionUser();
    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    const result = await turso.execute({
      sql: `SELECT id, user_id, title, description, deadline, completed_at, rank, pillar_id, milestone_id, schedule_type, window_start, created_at
            FROM tasks WHERE user_id = ?
            ORDER BY completed_at IS NOT NULL, rank ASC, id ASC;`,
      args: [user.id],
    });

    return NextResponse.json({ ok: true, tasks: result.rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load tasks";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};

export const POST = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as {
      title?: string;
      description?: string;
      deadline?: string | null;
      pillar_id?: number | null;
      milestone_id?: number | null;
    };

    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
    }
    if (body.deadline && !isYyyyMmDd(body.deadline)) {
      return NextResponse.json({ ok: false, error: "Invalid deadline" }, { status: 400 });
    }

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    const maxRank = await turso.execute({
      sql: `SELECT COALESCE(MAX(rank), -1) AS max_rank FROM tasks WHERE user_id = ?;`,
      args: [user.id],
    });
    const rank = Number((maxRank.rows[0] as Record<string, unknown>).max_rank) + 1;

    const result = await turso.execute({
      sql: `INSERT INTO tasks (user_id, title, description, deadline, rank, pillar_id, milestone_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING id, user_id, title, description, deadline, completed_at, rank, pillar_id, milestone_id, created_at;`,
      args: [
        user.id,
        title,
        body.description?.trim() || null,
        body.deadline ?? null,
        rank,
        body.pillar_id ?? null,
        body.milestone_id ?? null,
      ],
    });

    return NextResponse.json({ ok: true, task: result.rows[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create task";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
