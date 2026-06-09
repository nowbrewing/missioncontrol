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
    const milestoneId = Number(id);
    if (!Number.isFinite(milestoneId)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const body = (await req.json()) as {
      title?: string;
      target_date?: string | null;
      completed?: boolean;
    };
    if (body.target_date && !isYyyyMmDd(body.target_date)) {
      return NextResponse.json({ ok: false, error: "Invalid target_date" }, { status: 400 });
    }

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    const sets: string[] = [];
    const args: (string | number | null)[] = [];

    if (body.title !== undefined) {
      sets.push("title = ?");
      args.push(body.title.trim() || null);
    }
    if (body.target_date !== undefined) {
      sets.push("target_date = ?");
      args.push(body.target_date);
    }
    if (body.completed !== undefined) {
      sets.push("completed_at = ?");
      args.push(body.completed ? new Date().toISOString() : null);
    }
    if (sets.length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }

    args.push(milestoneId, user.id);
    await turso.execute({
      sql: `UPDATE milestones SET ${sets.join(", ")} WHERE id = ? AND user_id = ?;`,
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
    const milestoneId = Number(id);
    if (!Number.isFinite(milestoneId)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    await turso.execute({
      sql: `DELETE FROM milestones WHERE id = ? AND user_id = ?;`,
      args: [milestoneId, user.id],
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
