import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../../src/lib/date";
import {
  saveThinkpadNotes,
  type ThinkpadSaveTarget,
} from "../../../../src/lib/thinkpad-save";

export const runtime = "nodejs";

const TARGETS = new Set<ThinkpadSaveTarget>(["task", "milestone", "pillar", "general"]);

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();

    const body = (await req.json()) as {
      plan_date?: string;
      target?: string;
      target_id?: number | null;
      summary?: string;
    };

    const target = body.target as ThinkpadSaveTarget;
    if (!target || !TARGETS.has(target)) {
      return NextResponse.json({ ok: false, error: "Invalid target" }, { status: 400 });
    }

    const summary = body.summary?.trim() || "";
    if (!summary) {
      return NextResponse.json({ ok: false, error: "Summary is required" }, { status: 400 });
    }

    const planDate =
      body.plan_date && isYyyyMmDd(body.plan_date)
        ? body.plan_date
        : todayIsoYyyyMmDd();

    const result = await saveThinkpadNotes({
      userId: user.id,
      planDate,
      target,
      targetId: body.target_id ?? null,
      summary,
    });

    return NextResponse.json({ ok: true, saved: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Save failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[thinkpad/save]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
