import { NextResponse } from "next/server";
import { summarizeReflectionSession } from "../../../../src/lib/adk/summarize-reflection-session";
import type { LifeAgentMessage } from "../../../../src/lib/adk/run-life-agent";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd } from "../../../../src/lib/date";
import { saveReflectionSummary } from "../../../../src/lib/reflection-save";
import { mostRecentCompletedWeek } from "../../../../src/lib/reflection-week";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();

    const body = (await req.json()) as {
      week_monday?: string;
      week_end?: string;
      messages?: LifeAgentMessage[];
    };

    const defaultWeek = mostRecentCompletedWeek(
      new Date().toISOString().slice(0, 10)
    );
    const weekMonday =
      body.week_monday && isYyyyMmDd(body.week_monday)
        ? body.week_monday
        : defaultWeek.week_monday;
    const weekEnd =
      body.week_end && isYyyyMmDd(body.week_end) ? body.week_end : defaultWeek.week_end;

    const messages = (body.messages ?? []).filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    );

    if (!messages.some((m) => m.role === "user")) {
      return NextResponse.json({ ok: true, skipped: true, reason: "nothing_to_save" });
    }

    const summarized = await summarizeReflectionSession({
      weekMonday,
      weekEnd,
      messages,
    });

    if (!summarized?.summary.trim()) {
      return NextResponse.json(
        { ok: false, error: "Could not summarize session" },
        { status: 400 }
      );
    }

    const saved = await saveReflectionSummary({
      userId: user.id,
      weekMonday,
      weekEnd,
      summary: summarized.summary,
    });

    return NextResponse.json({
      ok: true,
      skipped: false,
      summary: summarized.summary,
      entry: saved.entry,
      pillar_ids: saved.pillar_ids,
      pillar_context_saved: saved.pillar_context_saved,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Autosave failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[reflection/autosave]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
