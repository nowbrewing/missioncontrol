import { NextResponse } from "next/server";
import { ensureLifeSchema } from "../../../src/db/life";
import { requireSessionUser } from "../../../src/lib/auth";
import { isYyyyMmDd } from "../../../src/lib/date";
import { requireTursoClient } from "../../../src/lib/turso";

export const POST = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as {
      pillar_id?: number;
      title?: string;
      target_date?: string | null;
    };

    const pillarId = body.pillar_id;
    const title = body.title?.trim();
    if (!pillarId || !title) {
      return NextResponse.json(
        { ok: false, error: "pillar_id and title are required" },
        { status: 400 }
      );
    }
    if (body.target_date && !isYyyyMmDd(body.target_date)) {
      return NextResponse.json({ ok: false, error: "Invalid target_date" }, { status: 400 });
    }

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    const pillar = await turso.execute({
      sql: `SELECT id FROM pillars WHERE id = ? AND user_id = ?;`,
      args: [pillarId, user.id],
    });
    if (pillar.rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Pillar not found" }, { status: 404 });
    }

    const maxRank = await turso.execute({
      sql: `SELECT COALESCE(MAX(rank), -1) AS max_rank FROM goals WHERE pillar_id = ? AND user_id = ?;`,
      args: [pillarId, user.id],
    });
    const rank = Number((maxRank.rows[0] as Record<string, unknown>).max_rank) + 1;

    const result = await turso.execute({
      sql: `INSERT INTO goals (user_id, pillar_id, title, target_date, rank)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id, user_id, pillar_id, title, target_date, rank, status, created_at;`,
      args: [user.id, pillarId, title, body.target_date ?? null, rank],
    });

    return NextResponse.json({ ok: true, goal: result.rows[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create goal";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
