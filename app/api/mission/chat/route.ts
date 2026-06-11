import { NextResponse } from "next/server";
import { runOpenChat } from "../../../../src/lib/adk/run-open-chat";
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

    const history = (body.history ?? []).filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    );

    const reply = await runOpenChat({
      userId: user.id,
      planDate,
      message,
      history,
    });

    return NextResponse.json({ ok: true, reply });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Chat failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[mission/chat]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
