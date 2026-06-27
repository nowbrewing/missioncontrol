import { NextResponse } from "next/server";
import { runMissionOrchestration } from "../../../../src/lib/adk/run-mission-orchestration";
import { storeAgentReflection } from "../../../../src/lib/adk/store-agent-reflection";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../../src/lib/date";
import { applyOrchestrationLayout } from "../../../../src/lib/mission-apply-orchestration-layout";
import { buildMissionBrief } from "../../../../src/lib/mission-brief";
import { isIdeaTask } from "../../../../src/lib/task-ideas";
import { listTasks } from "../../../../src/lib/mongodb/store/tasks";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();

    const body = (await req.json()) as { plan_date?: string };

    const planDate =
      body.plan_date && isYyyyMmDd(body.plan_date)
        ? body.plan_date
        : todayIsoYyyyMmDd();

    const orchestration = await runMissionOrchestration({
      userId: user.id,
      planDate,
      mode: "prioritize",
    });

    const openTasks = (await listTasks(user.id)).filter(
      (t) => !t.completed_at && !isIdeaTask(t)
    );
    const taskRows = openTasks.map((t) => ({
      id: Number(t.id),
      deadline: t.deadline,
      date_locked: Number(t.date_locked),
    }));

    await applyOrchestrationLayout(
      user.id,
      planDate,
      orchestration.layout,
      taskRows,
      orchestration.reschedules
    );

    await storeAgentReflection(user.id, planDate, orchestration.dayGuide);

    const brief = await buildMissionBrief(user.id, planDate);

    return NextResponse.json({
      ok: true,
      day_guide: orchestration.dayGuide,
      proposed_tasks: [],
      brief,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Prioritization failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[mission/prioritize]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
