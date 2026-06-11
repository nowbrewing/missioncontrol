import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../src/lib/auth";
import { isYyyyMmDd } from "../../../src/lib/date";
import {
  getMaxGoalRank,
  insertGoal,
} from "../../../src/lib/mongodb/store/goals";
import { listPillars } from "../../../src/lib/mongodb/store/users";

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

    const pillars = await listPillars(user.id);
    if (!pillars.some((pillar) => Number(pillar.id) === pillarId)) {
      return NextResponse.json({ ok: false, error: "Pillar not found" }, { status: 404 });
    }

    const rank = (await getMaxGoalRank(user.id)) + 1;
    const goal = await insertGoal(user.id, {
      pillarId,
      title,
      targetDate: body.target_date ?? null,
      rank,
    });

    return NextResponse.json({ ok: true, goal });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create goal";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
