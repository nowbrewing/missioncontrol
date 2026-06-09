import { NextResponse } from "next/server";
import { ensureLifeSchema } from "../../../src/db/life";
import { persistBrainDumpTasks } from "../../../src/lib/adk/persist-brain-dump-tasks";
import { runBrainDumpAgent } from "../../../src/lib/adk/run-brain-dump";
import { requireSessionUser } from "../../../src/lib/auth";
import {
  isYyyyMmDd,
  todayIsoYyyyMmDd,
} from "../../../src/lib/date";
import { appendDailyLogEntry } from "../../../src/lib/daily-log-entries";
import { getUserContext } from "../../../src/lib/ai/get-user-context";
import { requireTursoClient } from "../../../src/lib/turso";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();

    const body = (await req.json()) as {
      brain_dump?: string;
      plan_date?: string;
    };

    const brainDump = body.brain_dump?.trim() || "";
    if (!brainDump) {
      return NextResponse.json(
        { ok: false, error: "brain_dump is required" },
        { status: 400 }
      );
    }

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    const planDate =
      body.plan_date && isYyyyMmDd(body.plan_date)
        ? body.plan_date
        : todayIsoYyyyMmDd();

    const ctx = await getUserContext(turso, user.id);
    const pillarRows = (ctx.pillars as Record<string, unknown>[]).map((p) => ({
      id: Number(p.id),
      name: String(p.name),
    }));

    const { summary, tasks } = await runBrainDumpAgent(brainDump, {
      pillars: pillarRows,
      planDate,
      userId: user.id,
    });

    await appendDailyLogEntry(turso, user.id, planDate, "daily_focus", brainDump);

    const createdTasks =
      tasks.length > 0
        ? await persistBrainDumpTasks(turso, user.id, tasks, pillarRows)
        : [];

    return NextResponse.json({
      ok: true,
      summary,
      tasks: createdTasks,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Brain dump processing failed";
    const status =
      msg === "Unauthorized"
        ? 401
        : msg.includes("Missing") || msg.includes("not configured")
          ? 500
          : 500;
    console.error("[brain-dump]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
