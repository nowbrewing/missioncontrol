import { NextResponse } from "next/server";
import { ensureLifeSchema } from "../../../../src/db/life";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../../src/lib/date";
import { boardToLayout, type BoardItem } from "../../../../src/lib/mission-layout";
import { requireTursoClient } from "../../../../src/lib/turso";

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as {
      today?: BoardItem[];
      coming_up?: BoardItem[];
      layout_date?: string;
    };

    if (!Array.isArray(body.today) || !Array.isArray(body.coming_up)) {
      return NextResponse.json({ ok: false, error: "Invalid layout" }, { status: 400 });
    }

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);
    const layoutDate =
      body.layout_date && isYyyyMmDd(body.layout_date)
        ? body.layout_date
        : todayIsoYyyyMmDd();
    const layout = JSON.stringify(boardToLayout(body.today, body.coming_up));

    await turso.execute({
      sql: `INSERT INTO daily_logs (user_id, log_date, mission_layout, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(user_id, log_date) DO UPDATE SET
              mission_layout = excluded.mission_layout,
              updated_at = datetime('now');`,
      args: [user.id, layoutDate, layout],
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save layout";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
