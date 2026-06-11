import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../../src/lib/date";
import { buildMissionBrief } from "../../../../src/lib/mission-brief";
import {
  getMaxTaskRank,
  insertTask,
} from "../../../../src/lib/mongodb/store/tasks";

export const runtime = "nodejs";
export const maxDuration = 30;

type TaskBucket = "Today" | "This Week" | "Later";

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();

    const body = (await req.json()) as {
      plan_date?: string;
      tasks?: {
        title?: string;
        pillar_id?: number | null;
        deadline?: string | null;
        bucket?: TaskBucket;
      }[];
    };

    const planDate =
      body.plan_date && isYyyyMmDd(body.plan_date)
        ? body.plan_date
        : todayIsoYyyyMmDd();

    const tasks = body.tasks ?? [];
    if (tasks.length === 0) {
      return NextResponse.json({ ok: true, created_tasks: [], brief: await buildMissionBrief(user.id, planDate) });
    }

    let nextRank = (await getMaxTaskRank(user.id)) + 1;
    const created: Record<string, unknown>[] = [];

    for (const task of tasks) {
      const title = task.title?.trim();
      if (!title) continue;

      let deadline =
        task.deadline && isYyyyMmDd(task.deadline) ? task.deadline : null;
      if (!deadline && task.bucket === "Today") {
        deadline = planDate;
      }

      const row = await insertTask(user.id, {
        title,
        deadline,
        rank: nextRank++,
        pillarId: task.pillar_id ?? null,
        scheduleType: "flexible",
        isNew: true,
      });
      created.push(row);
    }

    const brief = await buildMissionBrief(user.id, planDate);

    return NextResponse.json({
      ok: true,
      created_tasks: created,
      brief,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save tasks";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[mission/proposed-tasks]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
