import { NextResponse } from "next/server";
import { ensureLifeSchema } from "../../../src/db/life";
import { requireSessionUser } from "../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../src/lib/date";
import {
  appendDailyLogEntries,
  buildDailyLogAggregate,
  type DailyLogKind,
} from "../../../src/lib/daily-log-entries";
import { requireTursoClient } from "../../../src/lib/turso";

export const GET = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? todayIsoYyyyMmDd();
    if (!isYyyyMmDd(date)) {
      return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
    }

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    const { entries, by_kind, aggregate } = await buildDailyLogAggregate(
      turso,
      user.id,
      date
    );

    return NextResponse.json({
      ok: true,
      date,
      entries,
      by_kind,
      aggregate,
      log: {
        log_date: date,
        went_well: aggregate.went_well || null,
        went_poorly: aggregate.went_poorly || null,
        daily_focus: aggregate.daily_focus || null,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load log";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};

export const POST = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as {
      log_date?: string;
      went_well?: string;
      went_poorly?: string;
      daily_focus?: string;
    };

    const logDate = body.log_date ?? todayIsoYyyyMmDd();
    if (!isYyyyMmDd(logDate)) {
      return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
    }

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);

    const toAppend: { kind: DailyLogKind; content: string }[] = [];
    if (body.went_well?.trim()) {
      toAppend.push({ kind: "went_well", content: body.went_well });
    }
    if (body.went_poorly?.trim()) {
      toAppend.push({ kind: "went_poorly", content: body.went_poorly });
    }
    if (body.daily_focus?.trim()) {
      toAppend.push({ kind: "daily_focus", content: body.daily_focus });
    }

    if (toAppend.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Add at least one note to save" },
        { status: 400 }
      );
    }

    const created = await appendDailyLogEntries(turso, user.id, logDate, toAppend);
    const { entries, by_kind, aggregate } = await buildDailyLogAggregate(
      turso,
      user.id,
      logDate
    );

    return NextResponse.json({
      ok: true,
      created,
      entries,
      by_kind,
      aggregate,
      log: {
        log_date: logDate,
        went_well: aggregate.went_well || null,
        went_poorly: aggregate.went_poorly || null,
        daily_focus: aggregate.daily_focus || null,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save log";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
