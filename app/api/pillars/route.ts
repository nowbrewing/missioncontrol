import { NextResponse } from "next/server";
import { ensureLifeSchema } from "../../../src/db/life";
import { requireSessionUser } from "../../../src/lib/auth";
import { normalizePillarAbbreviationInput } from "../../../src/lib/pillar-abbreviation";
import { isValidPillarColor, normalizePillarColor } from "../../../src/lib/pillar-colors";
import { requireTursoClient } from "../../../src/lib/turso";

export const GET = async () => {
  try {
    const user = await requireSessionUser();
    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    const pillars = await turso.execute({
      sql: `SELECT id, user_id, name, description, abbreviation, color, rank, created_at
            FROM pillars WHERE user_id = ? ORDER BY rank ASC, id ASC;`,
      args: [user.id],
    });

    const goals = await turso.execute({
      sql: `SELECT id, user_id, pillar_id, title, target_date, rank, status, created_at
            FROM goals WHERE user_id = ? ORDER BY rank ASC, id ASC;`,
      args: [user.id],
    });

    const milestones = await turso.execute({
      sql: `SELECT id, user_id, goal_id, pillar_id, title, target_date, rank, completed_at, created_at
            FROM milestones WHERE user_id = ? ORDER BY rank ASC, id ASC;`,
      args: [user.id],
    });

    return NextResponse.json({
      ok: true,
      pillars: pillars.rows,
      goals: goals.rows,
      milestones: milestones.rows,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load pillars";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};

export const POST = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as {
      name?: string;
      description?: string;
      abbreviation?: string | null;
      color?: string;
    };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
    }
    const color = body.color?.trim();
    if (color && !isValidPillarColor(color)) {
      return NextResponse.json({ ok: false, error: "Invalid color" }, { status: 400 });
    }

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    const maxRank = await turso.execute({
      sql: `SELECT COALESCE(MAX(rank), -1) AS max_rank FROM pillars WHERE user_id = ?;`,
      args: [user.id],
    });
    const rank = Number((maxRank.rows[0] as Record<string, unknown>).max_rank) + 1;

    const abbreviation =
      body.abbreviation !== undefined
        ? normalizePillarAbbreviationInput(String(body.abbreviation ?? ""))
        : null;

    const result = await turso.execute({
      sql: `INSERT INTO pillars (user_id, name, description, abbreviation, color, rank)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING id, user_id, name, description, abbreviation, color, rank, created_at;`,
      args: [
        user.id,
        name,
        body.description?.trim() || null,
        abbreviation,
        normalizePillarColor(color),
        rank,
      ],
    });

    return NextResponse.json({ ok: true, pillar: result.rows[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create pillar";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
