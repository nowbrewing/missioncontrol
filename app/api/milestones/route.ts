import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../src/lib/auth";
import { isYyyyMmDd } from "../../../src/lib/date";
import {
  getMaxMilestoneRank,
  insertMilestone,
  listMilestones,
} from "../../../src/lib/mongodb/store/milestones";
import { listGoals } from "../../../src/lib/mongodb/store/goals";
import { listPillars } from "../../../src/lib/mongodb/store/users";

export const GET = async () => {
  try {
    const user = await requireSessionUser();
    const milestones = await listMilestones(user.id);
    return NextResponse.json({ ok: true, milestones });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load milestones";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};

export const POST = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as {
      pillar_id?: number;
      goal_id?: number;
      title?: string;
      target_date?: string | null;
    };

    const title = body.title?.trim();
    const pillarId = body.pillar_id;
    const goalId = body.goal_id;

    if (!title) {
      return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
    }
    if (!pillarId && !goalId) {
      return NextResponse.json(
        { ok: false, error: "pillar_id or goal_id is required" },
        { status: 400 }
      );
    }
    if (body.target_date && !isYyyyMmDd(body.target_date)) {
      return NextResponse.json({ ok: false, error: "Invalid target_date" }, { status: 400 });
    }

    let resolvedPillarId = pillarId ?? null;

    if (goalId) {
      const goals = await listGoals(user.id);
      const goal = goals.find((item) => Number(item.id) === goalId);
      if (!goal) {
        return NextResponse.json({ ok: false, error: "Goal not found" }, { status: 404 });
      }
      resolvedPillarId = Number(goal.pillar_id);
    } else if (pillarId) {
      const pillars = await listPillars(user.id);
      if (!pillars.some((pillar) => Number(pillar.id) === pillarId)) {
        return NextResponse.json({ ok: false, error: "Pillar not found" }, { status: 404 });
      }
    }

    const rank = (await getMaxMilestoneRank(user.id)) + 1;
    const milestone = await insertMilestone(user.id, {
      goalId: goalId ?? null,
      pillarId: resolvedPillarId,
      title,
      targetDate: body.target_date ?? null,
      rank,
    });

    return NextResponse.json({ ok: true, milestone });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create milestone";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
