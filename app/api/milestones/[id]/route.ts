import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd } from "../../../../src/lib/date";
import {
  deleteMilestone,
  updateMilestone,
} from "../../../../src/lib/mongodb/store/milestones";

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

    const patch: {
      title?: string;
      targetDate?: string | null;
      completedAt?: string | null;
    } = {};

    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
      }
      patch.title = title;
    }
    if (body.target_date !== undefined) {
      patch.targetDate = body.target_date;
    }
    if (body.completed !== undefined) {
      patch.completedAt = body.completed ? new Date().toISOString() : null;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }

    await updateMilestone(user.id, milestoneId, patch);

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

    await deleteMilestone(user.id, milestoneId);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
