import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../../src/lib/date";
import { boardToLayout, type BoardItem } from "../../../../src/lib/mission-layout";
import {
  getMissionLayout,
  upsertMissionLayout,
} from "../../../../src/lib/mongodb/store/daily-logs";

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as {
      today?: BoardItem[];
      coming_up?: BoardItem[];
      layout_date?: string;
      today_user_ordered?: boolean;
    };

    if (!Array.isArray(body.today) || !Array.isArray(body.coming_up)) {
      return NextResponse.json({ ok: false, error: "Invalid layout" }, { status: 400 });
    }

    const layoutDate =
      body.layout_date && isYyyyMmDd(body.layout_date)
        ? body.layout_date
        : todayIsoYyyyMmDd();

    const existing = await getMissionLayout(user.id, layoutDate);
    const todayUserOrdered =
      body.today_user_ordered === true
        ? true
        : (existing?.today_user_ordered ?? false);

    await upsertMissionLayout(user.id, layoutDate, {
      ...boardToLayout(body.today, body.coming_up),
      later: existing?.later,
      reflection: existing?.reflection,
      today_user_ordered: todayUserOrdered,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save layout";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
