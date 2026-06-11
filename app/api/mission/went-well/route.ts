import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../../src/lib/date";
import { appendWentWellEntries } from "../../../../src/lib/mongodb/store/daily-logs";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();

    const body = (await req.json()) as {
      log_date?: string;
      statements?: { content?: string; pillar_ids?: number[] }[];
    };

    const logDate =
      body.log_date && isYyyyMmDd(body.log_date)
        ? body.log_date
        : todayIsoYyyyMmDd();

    const statements = (body.statements ?? [])
      .map((s) => ({
        content: s.content?.trim() ?? "",
        pillar_ids: [...new Set(s.pillar_ids ?? [])].sort((a, b) => a - b),
      }))
      .filter((s) => s.content);

    if (statements.length === 0) {
      return NextResponse.json({ ok: true, created_entries: [] });
    }

    const created = await appendWentWellEntries(user.id, logDate, statements);

    return NextResponse.json({
      ok: true,
      created_entries: created,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save wins";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[mission/went-well]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
