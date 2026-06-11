import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd } from "../../../../src/lib/date";
import { deleteGoal, updateGoal } from "../../../../src/lib/mongodb/store/goals";

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

    await updateGoal(user.id, goalId, {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.target_date !== undefined ? { targetDate: body.target_date } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
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

    await deleteGoal(user.id, goalId);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
