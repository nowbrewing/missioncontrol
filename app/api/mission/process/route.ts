import { NextResponse } from "next/server";
import { reflectAndPrioritize } from "../../../../src/lib/ai/mission-checkin-agent";
import { extractTasksFromIntake, persistProcessedTasks } from "../../../../src/lib/ai/mission-process";
import { applyPrioritization } from "../../../../src/lib/mission-apply-prioritization";
import { assertChatProviderConfigured } from "../../../../src/lib/ai/provider";
import { requireSessionUser } from "../../../../src/lib/auth";
import {
  addDaysIsoYyyyMmDd,
  isYyyyMmDd,
  todayIsoYyyyMmDd,
} from "../../../../src/lib/date";
import { buildMissionBrief } from "../../../../src/lib/mission-brief";
import { ensureLifeSchema } from "../../../../src/db/life";
import { appendDailyLogEntry } from "../../../../src/lib/daily-log-entries";
import { requireTursoClient } from "../../../../src/lib/turso";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    assertChatProviderConfigured();

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

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    const planDate =
      body.plan_date && isYyyyMmDd(body.plan_date)
        ? body.plan_date
        : todayIsoYyyyMmDd();
    const dayBeforePlan = addDaysIsoYyyyMmDd(planDate, -1);

    if (wentWell) {
      await appendDailyLogEntry(turso, user.id, dayBeforePlan, "went_well", wentWell);
    }

    if (topOfMind) {
      await appendDailyLogEntry(turso, user.id, planDate, "daily_focus", topOfMind);
    }

    const extracted = await extractTasksFromIntake(
      wentWell,
      topOfMind,
      user.id,
      turso,
      planDate
    );
    const intakeText = `${wentWell}\n${topOfMind}`;
    const createdTasks =
      extracted.tasks.length > 0
        ? await persistProcessedTasks(
            turso,
            user.id,
            extracted.tasks,
            intakeText,
            planDate
          )
        : [];

    const prioritization = await reflectAndPrioritize(turso, user.id, planDate, {
      went_well: wentWell,
      top_of_mind: topOfMind,
    });
    await applyPrioritization(turso, user.id, planDate, prioritization);

    const brief = await buildMissionBrief(turso, user.id, planDate);

    return NextResponse.json({
      ok: true,
      created_tasks: createdTasks,
      promoted_tasks: extracted.promote_to_today,
      reflection: prioritization.reflection,
      flags: prioritization.flags,
      buckets: prioritization.buckets,
      brief,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Processing failed";
    const status =
      msg === "Unauthorized"
        ? 401
        : msg.includes("Missing") || msg.includes("not configured")
          ? 500
          : 500;
    console.error("[mission/process]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
