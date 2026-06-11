import { NextResponse } from "next/server";
import { runMissionOrchestration } from "../../../../src/lib/adk/run-mission-orchestration";
import { storeAgentReflection } from "../../../../src/lib/adk/store-agent-reflection";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../../src/lib/date";
import { appendDailyLogEntry } from "../../../../src/lib/daily-log-entries";
import { pillarIdsForLogText } from "../../../../src/lib/daily-log-pillar-tags";
import { extractAndApplyPillarContextFromCheckIn } from "../../../../src/lib/apply-check-in-pillar-context";
import { applyOrchestrationLayout } from "../../../../src/lib/mission-apply-orchestration-layout";
import { buildMissionBrief } from "../../../../src/lib/mission-brief";
import { listPillars } from "../../../../src/lib/mongodb/store/users";
import { listTasks } from "../../../../src/lib/mongodb/store/tasks";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();

    const body = (await req.json()) as {
      went_well_yesterday?: string;
      top_of_mind_today?: string;
      plan_date?: string;
    };

    const wentWell = body.went_well_yesterday?.trim() || "";
    const topOfMind = body.top_of_mind_today?.trim() || "";

    if (!wentWell && !topOfMind) {
      return NextResponse.json(
        { ok: false, error: "Share what went well or what's on your mind today" },
        { status: 400 }
      );
    }

    const planDate =
      body.plan_date && isYyyyMmDd(body.plan_date)
        ? body.plan_date
        : todayIsoYyyyMmDd();
    const pillars = await listPillars(user.id);

    // Both entries anchor to the check-in / plan date — backward wins + forward brain dump.
    const [wentWellPillarIds, topOfMindPillarIds] = await Promise.all([
      wentWell ? pillarIdsForLogText(wentWell, pillars) : Promise.resolve([]),
      topOfMind ? pillarIdsForLogText(topOfMind, pillars) : Promise.resolve([]),
    ]);

    if (wentWell) {
      await appendDailyLogEntry(
        user.id,
        planDate,
        "went_well",
        wentWell,
        wentWellPillarIds
      );
    }

    if (topOfMind) {
      await appendDailyLogEntry(
        user.id,
        planDate,
        "daily_focus",
        topOfMind,
        topOfMindPillarIds
      );
    }

    if (!topOfMind) {
      const pillarContextSaved =
        wentWell || topOfMind
          ? await extractAndApplyPillarContextFromCheckIn(
              user.id,
              planDate,
              { brainDump: topOfMind || undefined, wins: wentWell || undefined },
              pillars.map((p) => ({
                id: Number(p.id),
                name: String(p.name),
                description: p.description ? String(p.description) : null,
              }))
            )
          : [];
      const brief = await buildMissionBrief(user.id, planDate);
      return NextResponse.json({
        ok: true,
        summary: null,
        proposed_tasks: [],
        pillar_context_saved: pillarContextSaved,
        brief,
      });
    }

    const pillarContextPromise = extractAndApplyPillarContextFromCheckIn(
      user.id,
      planDate,
      { brainDump: topOfMind, wins: wentWell || undefined },
      pillars.map((p) => ({
        id: Number(p.id),
        name: String(p.name),
        description: p.description ? String(p.description) : null,
      }))
    );

    const [orchestration, pillarContextSaved] = await Promise.all([
      runMissionOrchestration({
        userId: user.id,
        planDate,
        mode: "check_in",
        brainDump: topOfMind,
      }),
      pillarContextPromise,
    ]);

    const openTasks = (await listTasks(user.id)).filter((t) => !t.completed_at);
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

    const briefAfterAgent = await buildMissionBrief(user.id, planDate);

    return NextResponse.json({
      ok: true,
      day_guide: orchestration.dayGuide,
      proposed_tasks: orchestration.proposedTasks,
      pillar_context_saved: pillarContextSaved,
      brief: briefAfterAgent,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Processing failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[mission/process]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
