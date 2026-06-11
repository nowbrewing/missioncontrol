import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd } from "../../../../src/lib/date";
import { buildMissionBrief } from "../../../../src/lib/mission-brief";

export async function GET(req: Request) {
  try {
    const user = await requireSessionUser();
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const focusDate = dateParam && isYyyyMmDd(dateParam) ? dateParam : undefined;

    const brief = await buildMissionBrief(user.id, focusDate);
    return NextResponse.json({ ok: true, ...brief });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load brief";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
