import { NextResponse } from "next/server";
import { CORRECTION_KICKOFF } from "../../../../src/lib/correction-records";
import { buildCorrectionSystemContext } from "../../../../src/lib/adk/run-correction-chat";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../../src/lib/date";
import { formatWeekRangeLong } from "../../../../src/lib/reflection-week";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireSessionUser();
    const url = new URL(req.url);
    const planDateParam = url.searchParams.get("plan_date");

    const planDate =
      planDateParam && isYyyyMmDd(planDateParam)
        ? planDateParam
        : todayIsoYyyyMmDd();

    const ctx = await buildCorrectionSystemContext(user.id, planDate);

    return NextResponse.json({
      ok: true,
      plan_date: planDate,
      week_monday: ctx.scope.week_monday,
      week_end: ctx.scope.week_end,
      week_label: formatWeekRangeLong(ctx.scope.week_monday, ctx.scope.week_end),
      record_count: ctx.records.length,
      kickoff: CORRECTION_KICKOFF,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load correction context";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[correction/context]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
