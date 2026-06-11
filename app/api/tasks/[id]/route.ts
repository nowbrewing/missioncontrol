import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd } from "../../../../src/lib/date";
import { normalizeScheduleType, type ScheduleType } from "../../../../src/lib/task-schedule";
import { deleteTask, updateTask } from "../../../../src/lib/mongodb/store/tasks";

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
      date_locked?: boolean;
    };
    if (body.deadline && !isYyyyMmDd(body.deadline)) {
      return NextResponse.json({ ok: false, error: "Invalid deadline" }, { status: 400 });
    }

    const patch: Partial<{
      title: string;
      description: string | null;
      deadline: string | null;
      completedAt: string | null;
      pillarId: number | null;
      milestoneId: number | null;
      scheduleType: string;
      windowStart: string | null;
      dateLocked: boolean;
    }> = {};

    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
      }
      patch.title = title;
    }
    if (body.description !== undefined) {
      patch.description = body.description?.trim() || null;
    }
    if (body.deadline !== undefined) {
      patch.deadline = body.deadline;
    }
    if (body.completed !== undefined) {
      patch.completedAt = body.completed ? new Date().toISOString() : null;
    }
    if (body.pillar_id !== undefined) {
      patch.pillarId = body.pillar_id;
    }
    if (body.milestone_id !== undefined) {
      patch.milestoneId = body.milestone_id;
    }
    if (body.schedule_type !== undefined) {
      patch.scheduleType = normalizeScheduleType(body.schedule_type);
    }
    if (body.window_start !== undefined) {
      if (body.window_start && !isYyyyMmDd(body.window_start)) {
        return NextResponse.json({ ok: false, error: "Invalid window_start" }, { status: 400 });
      }
      patch.windowStart = body.window_start;
    }
    if (body.date_locked !== undefined) {
      patch.dateLocked = body.date_locked;
      if (body.date_locked) {
        patch.scheduleType = "fixed";
      }
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }

    await updateTask(user.id, taskId, patch);

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

    await deleteTask(user.id, taskId);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
