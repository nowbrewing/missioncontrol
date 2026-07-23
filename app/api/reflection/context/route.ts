import { NextResponse } from "next/server";
import { buildReflectionSystemContext } from "../../../../src/lib/adk/run-reflection-chat";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../../src/lib/date";
import { formatWeekRangeLong } from "../../../../src/lib/reflection-week";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireSessionUser();
    const url = new URL(req.url);
    const planDateParam = url.searchParams.get("plan_date");
    const weekMondayParam = url.searchParams.get("week_monday");
    const weekEndParam = url.searchParams.get("week_end");
    const pillarParam = url.searchParams.get("pillar");

    const planDate =
      planDateParam && isYyyyMmDd(planDateParam)
        ? planDateParam
        : todayIsoYyyyMmDd();

    const weekMonday =
      weekMondayParam && isYyyyMmDd(weekMondayParam) ? weekMondayParam : undefined;
    const weekEnd =
      weekEndParam && isYyyyMmDd(weekEndParam) ? weekEndParam : undefined;

    const pillarIdRaw = pillarParam ? Number(pillarParam) : null;
    const pillarId =
      pillarIdRaw != null && Number.isFinite(pillarIdRaw) ? pillarIdRaw : null;

    const ctx = await buildReflectionSystemContext(
      user.id,
      planDate,
      weekMonday,
      weekEnd,
      pillarId
    );

    return NextResponse.json({
      ok: true,
      plan_date: planDate,
      week_monday: ctx.range.week_monday,
      week_end: ctx.range.week_end,
      week_label: formatWeekRangeLong(ctx.range.week_monday, ctx.range.week_end),
      pillar_id: ctx.pillar_id,
      pillar_name: ctx.pillar_name,
      kickoff: ctx.kickoff,
      recap: {
        scheduled_count: ctx.recap.scheduled.length,
        completed_count: ctx.recap.completed.length,
        missed_count: ctx.recap.missed.length,
        has_daily_logs: !!(
          ctx.recap.daily_logs.went_well ||
          ctx.recap.daily_logs.went_poorly ||
          ctx.recap.daily_logs.daily_focus
        ),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load reflection context";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[reflection/context]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
