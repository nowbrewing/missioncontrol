import { NextResponse } from "next/server";
import { summarizeAndSaveChatSession } from "../../../../../src/lib/adk/summarize-chat-session";
import type { LifeAgentMessage } from "../../../../../src/lib/adk/run-life-agent";
import { requireSessionUser } from "../../../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../../../src/lib/date";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();

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

    const result = await summarizeAndSaveChatSession({
      userId: user.id,
      planDate,
      messages,
    });

    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Nothing to summarize" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      summary: result.summary,
      pillar_ids: result.pillar_ids,
      entry_id: result.entry_id,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Summarize failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[mission/chat/summarize]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
