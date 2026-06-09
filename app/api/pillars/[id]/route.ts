import { NextResponse } from "next/server";
import { ensureLifeSchema } from "../../../../src/db/life";
import { requireSessionUser } from "../../../../src/lib/auth";
import { normalizePillarAbbreviationInput } from "../../../../src/lib/pillar-abbreviation";
import { isValidPillarColor, normalizePillarColor } from "../../../../src/lib/pillar-colors";
import { requireTursoClient } from "../../../../src/lib/turso";

type Params = { params: Promise<{ id: string }> };

export const PATCH = async (req: Request, { params }: Params) => {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const pillarId = Number(id);
    if (!Number.isFinite(pillarId)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const body = (await req.json()) as {
      name?: string;
      description?: string | null;
      abbreviation?: string | null;
      color?: string;
    };
    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    if (body.color !== undefined && !isValidPillarColor(body.color)) {
      return NextResponse.json({ ok: false, error: "Invalid color" }, { status: 400 });
    }

    const sets: string[] = [];
    const args: (string | number | null)[] = [];

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
      }
      sets.push("name = ?");
      args.push(name);
    }
    if (body.description !== undefined) {
      sets.push("description = ?");
      args.push(
        typeof body.description === "string" ? body.description.trim() || null : null
      );
    }
    if (body.color !== undefined) {
      sets.push("color = ?");
      args.push(normalizePillarColor(body.color));
    }
    if (body.abbreviation !== undefined) {
      sets.push("abbreviation = ?");
      args.push(normalizePillarAbbreviationInput(String(body.abbreviation ?? "")));
    }
    if (sets.length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }

    args.push(pillarId, user.id);
    await turso.execute({
      sql: `UPDATE pillars SET ${sets.join(", ")} WHERE id = ? AND user_id = ?;`,
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
    const pillarId = Number(id);
    if (!Number.isFinite(pillarId)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    await turso.execute({
      sql: `DELETE FROM pillars WHERE id = ? AND user_id = ?;`,
      args: [pillarId, user.id],
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
