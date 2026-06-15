import { NextResponse } from "next/server";
import { summarizeReflectionSession } from "../../../../src/lib/adk/summarize-reflection-session";
import type { LifeAgentMessage } from "../../../../src/lib/adk/run-life-agent";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd } from "../../../../src/lib/date";
import { mostRecentCompletedWeek } from "../../../../src/lib/reflection-week";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    await requireSessionUser();

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

    const result = await summarizeReflectionSession({
      weekMonday,
      weekEnd,
      messages,
    });

    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Nothing to summarize" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Summarize failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[reflection/summarize]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
