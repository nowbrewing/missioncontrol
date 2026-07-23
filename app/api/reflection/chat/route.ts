import { NextResponse } from "next/server";
import { runReflectionChat } from "../../../../src/lib/adk/run-reflection-chat";
import type { LifeAgentMessage } from "../../../../src/lib/adk/run-life-agent";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../../src/lib/date";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();

    const body = (await req.json()) as {
      message?: string;
      plan_date?: string;
      week_monday?: string;
      week_end?: string;
      pillar_id?: number | null;
      history?: LifeAgentMessage[];
    };

    const message = body.message?.trim() || "";
    if (!message) {
      return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
    }

    const planDate =
      body.plan_date && isYyyyMmDd(body.plan_date)
        ? body.plan_date
        : todayIsoYyyyMmDd();

    const weekMonday =
      body.week_monday && isYyyyMmDd(body.week_monday) ? body.week_monday : undefined;
    const weekEnd =
      body.week_end && isYyyyMmDd(body.week_end) ? body.week_end : undefined;

    const pillarIdRaw = body.pillar_id != null ? Number(body.pillar_id) : null;
    const pillarId =
      pillarIdRaw != null && Number.isFinite(pillarIdRaw) ? pillarIdRaw : null;

    const history = (body.history ?? []).filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    );

    const reply = await runReflectionChat({
      userId: user.id,
      planDate,
      message,
      history,
      weekMonday,
      weekEnd,
      pillarId,
    });

    return NextResponse.json({ ok: true, reply });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Chat failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[reflection/chat]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
