import { NextResponse } from "next/server";
import { runLifeAgentOrchestrator } from "../../../../src/lib/agent";
import type { ForcedSkillId } from "../../../../src/lib/chat-mode";
import type { LifeAgentMessage } from "../../../../src/lib/adk/run-life-agent";
import { normalizeChatMode } from "../../../../src/lib/chat-mode";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../../src/lib/date";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();

    const body = (await req.json()) as {
      message?: string;
      plan_date?: string;
      history?: LifeAgentMessage[];
      mode?: string;
      forced_skill?: ForcedSkillId | null;
      general_handoff_summary?: string | null;
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

    const mode = normalizeChatMode(body.mode);
    const forcedSkill: ForcedSkillId | null =
      body.forced_skill ??
      (mode === "general"
        ? "general"
        : mode === "correction"
          ? "correction"
          : null);

    const handoffSummary =
      typeof body.general_handoff_summary === "string" &&
      body.general_handoff_summary.trim()
        ? body.general_handoff_summary.trim()
        : null;

    const result = await runLifeAgentOrchestrator({
      userId: user.id,
      planDate,
      message,
      history,
      generalHandoffSummary: mode === "copilot" ? handoffSummary : null,
      forcedSkill,
    });

    return NextResponse.json({
      ok: true,
      reply: result.reply,
      routed: result.routed,
      proposed_tasks: result.proposed_tasks,
      task_edits: result.task_edits,
      correction_proposals: result.correction_proposals,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Chat failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[mission/chat]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
