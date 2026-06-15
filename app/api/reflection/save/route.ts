import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd } from "../../../../src/lib/date";
import { saveReflectionSummary } from "../../../../src/lib/reflection-save";
import { mostRecentCompletedWeek } from "../../../../src/lib/reflection-week";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();

    const body = (await req.json()) as {
      week_monday?: string;
      week_end?: string;
      summary?: string;
    };

    const summary = body.summary?.trim() || "";
    if (!summary) {
      return NextResponse.json({ ok: false, error: "Summary is required" }, { status: 400 });
    }

    const defaultWeek = mostRecentCompletedWeek(
      new Date().toISOString().slice(0, 10)
    );
    const weekMonday =
      body.week_monday && isYyyyMmDd(body.week_monday)
        ? body.week_monday
        : defaultWeek.week_monday;
    const weekEnd =
      body.week_end && isYyyyMmDd(body.week_end) ? body.week_end : defaultWeek.week_end;

    const saved = await saveReflectionSummary({
      userId: user.id,
      weekMonday,
      weekEnd,
      summary,
    });

    return NextResponse.json({
      ok: true,
      entry: saved.entry,
      pillar_ids: saved.pillar_ids,
      pillar_context_saved: saved.pillar_context_saved,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Save failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[reflection/save]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
