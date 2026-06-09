import { NextResponse } from "next/server";
import { ensureLifeSchema } from "../../../../src/db/life";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd } from "../../../../src/lib/date";
import { normalizeScheduleType, type ScheduleType } from "../../../../src/lib/task-schedule";
import { requireTursoClient } from "../../../../src/lib/turso";

type Params = { params: Promise<{ id: string }> };

export const PATCH = async (req: Request, { params }: Params) => {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const taskId = Number(id);
    if (!Number.isFinite(taskId)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const body = (await req.json()) as {
      title?: string;
      description?: string;
      deadline?: string | null;
      completed?: boolean;
      pillar_id?: number | null;
      milestone_id?: number | null;
      schedule_type?: ScheduleType;
      window_start?: string | null;
    };
    if (body.deadline && !isYyyyMmDd(body.deadline)) {
      return NextResponse.json({ ok: false, error: "Invalid deadline" }, { status: 400 });
    }

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
    if (body.description !== undefined) {
      sets.push("description = ?");
      args.push(body.description?.trim() || null);
    }
    if (body.deadline !== undefined) {
      sets.push("deadline = ?");
      args.push(body.deadline);
    }
    if (body.completed !== undefined) {
      sets.push("completed_at = ?");
      args.push(body.completed ? new Date().toISOString() : null);
    }
    if (body.pillar_id !== undefined) {
      sets.push("pillar_id = ?");
      args.push(body.pillar_id);
    }
    if (body.milestone_id !== undefined) {
      sets.push("milestone_id = ?");
      args.push(body.milestone_id);
    }
    if (body.schedule_type !== undefined) {
      sets.push("schedule_type = ?");
      args.push(normalizeScheduleType(body.schedule_type));
    }
    if (body.window_start !== undefined) {
      if (body.window_start && !isYyyyMmDd(body.window_start)) {
        return NextResponse.json({ ok: false, error: "Invalid window_start" }, { status: 400 });
      }
      sets.push("window_start = ?");
      args.push(body.window_start);
    }
    if (sets.length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }

    args.push(taskId, user.id);
    await turso.execute({
      sql: `UPDATE tasks SET ${sets.join(", ")} WHERE id = ? AND user_id = ?;`,
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
    const taskId = Number(id);
    if (!Number.isFinite(taskId)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    await turso.execute({
      sql: `DELETE FROM tasks WHERE id = ? AND user_id = ?;`,
      args: [taskId, user.id],
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
