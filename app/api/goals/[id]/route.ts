import { NextResponse } from "next/server";
import { ensureLifeSchema } from "../../../../src/db/life";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd } from "../../../../src/lib/date";
import { requireTursoClient } from "../../../../src/lib/turso";

type Params = { params: Promise<{ id: string }> };

export const PATCH = async (req: Request, { params }: Params) => {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const goalId = Number(id);
    if (!Number.isFinite(goalId)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const body = (await req.json()) as {
      title?: string;
      target_date?: string | null;
      status?: string;
    };
    if (body.target_date && !isYyyyMmDd(body.target_date)) {
      return NextResponse.json({ ok: false, error: "Invalid target_date" }, { status: 400 });
    }

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    await turso.execute({
      sql: `UPDATE goals SET
              title = COALESCE(?, title),
              target_date = COALESCE(?, target_date),
              status = COALESCE(?, status)
            WHERE id = ? AND user_id = ?;`,
      args: [
        body.title?.trim() || null,
        body.target_date !== undefined ? body.target_date : null,
        body.status || null,
        goalId,
        user.id,
      ],
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
    const goalId = Number(id);
    if (!Number.isFinite(goalId)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    await turso.execute({
      sql: `DELETE FROM goals WHERE id = ? AND user_id = ?;`,
      args: [goalId, user.id],
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
