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
      sql: `SELECT id, title, target_date, completed_at, pillar_id, rank
            FROM milestones WHERE user_id = ?
            ORDER BY rank ASC, id ASC;`,
      args: [user.id],
    });

    return NextResponse.json({ ok: true, milestones: result.rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load milestones";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};

export const POST = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as {
      pillar_id?: number;
      goal_id?: number;
      title?: string;
      target_date?: string | null;
    };

    const title = body.title?.trim();
    const pillarId = body.pillar_id;
    const goalId = body.goal_id;

    if (!title) {
      return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
    }
    if (!pillarId && !goalId) {
      return NextResponse.json(
        { ok: false, error: "pillar_id or goal_id is required" },
        { status: 400 }
      );
    }
    if (body.target_date && !isYyyyMmDd(body.target_date)) {
      return NextResponse.json({ ok: false, error: "Invalid target_date" }, { status: 400 });
    }

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    let resolvedPillarId = pillarId ?? null;

    if (goalId) {
      const goal = await turso.execute({
        sql: `SELECT id, pillar_id FROM goals WHERE id = ? AND user_id = ?;`,
        args: [goalId, user.id],
      });
      if (goal.rows.length === 0) {
        return NextResponse.json({ ok: false, error: "Goal not found" }, { status: 404 });
      }
      resolvedPillarId = Number((goal.rows[0] as Record<string, unknown>).pillar_id);
    } else if (pillarId) {
      const pillar = await turso.execute({
        sql: `SELECT id FROM pillars WHERE id = ? AND user_id = ?;`,
        args: [pillarId, user.id],
      });
      if (pillar.rows.length === 0) {
        return NextResponse.json({ ok: false, error: "Pillar not found" }, { status: 404 });
      }
    }

    const maxRank = await turso.execute({
      sql: `SELECT COALESCE(MAX(rank), -1) AS max_rank FROM milestones
            WHERE user_id = ? AND pillar_id = ?;`,
      args: [user.id, resolvedPillarId],
    });
    const rank = Number((maxRank.rows[0] as Record<string, unknown>).max_rank) + 1;

    const result = await turso.execute({
      sql: `INSERT INTO milestones (user_id, goal_id, pillar_id, title, target_date, rank)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING id, user_id, goal_id, pillar_id, title, target_date, rank, completed_at, created_at;`,
      args: [
        user.id,
        goalId ?? null,
        resolvedPillarId,
        title,
        body.target_date ?? null,
        rank,
      ],
    });

    return NextResponse.json({ ok: true, milestone: result.rows[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create milestone";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
