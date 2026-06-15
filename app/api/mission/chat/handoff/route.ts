import { NextResponse } from "next/server";
import { handoffGeneralChat } from "../../../../../src/lib/adk/handoff-general-chat";
import type { LifeAgentMessage } from "../../../../../src/lib/adk/run-life-agent";
import { requireSessionUser } from "../../../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../../../src/lib/date";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    await requireSessionUser();

    const body = (await req.json()) as {
      plan_date?: string;
      messages?: LifeAgentMessage[];
    };

    const planDate =
      body.plan_date && isYyyyMmDd(body.plan_date)
        ? body.plan_date
        : todayIsoYyyyMmDd();

    const messages = (body.messages ?? []).filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    );

    const result = await handoffGeneralChat({ planDate, messages });
    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Nothing to hand off" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      worth_keeping: result.worthKeeping,
      summary: result.summary,
      reply: result.reply,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Handoff failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[mission/chat/handoff]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
