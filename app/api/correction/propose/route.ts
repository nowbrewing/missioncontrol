import { NextResponse } from "next/server";
import { proposeCorrections } from "../../../../src/lib/adk/propose-corrections";
import type { LifeAgentMessage } from "../../../../src/lib/adk/run-life-agent";
import { buildCorrectionCorpus } from "../../../../src/lib/correction-records";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../../src/lib/date";

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

    const { scope, records } = await buildCorrectionCorpus(user.id, planDate);
    const corrections = await proposeCorrections({ scope, records, messages });

    return NextResponse.json({ ok: true, corrections });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Propose failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[correction/propose]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
