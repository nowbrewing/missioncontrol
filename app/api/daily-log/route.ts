import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../src/lib/auth";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "../../../src/lib/date";
import {
  appendDailyLogEntries,
  buildDailyLogAggregate,
  groupEntriesByKind,
  listDailyLogEntriesInRange,
  type DailyLogKind,
} from "../../../src/lib/daily-log-entries";
import { listPillars } from "../../../src/lib/mongodb/store/users";

async function pillarsForResponse(userId: number) {
  const pillars = await listPillars(userId);
  return pillars.map((p) => ({
    id: Number(p.id),
    name: String(p.name),
    abbreviation: p.abbreviation ?? null,
    color: String(p.color ?? "#FF6F61"),
    rank: Number(p.rank),
  }));
}

export const GET = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const pillars = await pillarsForResponse(user.id);

    if (from && to) {
      if (!isYyyyMmDd(from) || !isYyyyMmDd(to)) {
        return NextResponse.json({ ok: false, error: "Invalid date range" }, { status: 400 });
      }
      if (from > to) {
        return NextResponse.json(
          { ok: false, error: "Start date must be on or before end date" },
          { status: 400 }
        );
      }

      const entries = await listDailyLogEntriesInRange(user.id, from, to);
      return NextResponse.json({
        ok: true,
        from,
        to,
        entries,
        by_kind: groupEntriesByKind(entries),
        pillars,
      });
    }

    const date = url.searchParams.get("date") ?? todayIsoYyyyMmDd();
    if (!isYyyyMmDd(date)) {
      return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
    }

    const { entries, by_kind, aggregate } = await buildDailyLogAggregate(user.id, date);

    return NextResponse.json({
      ok: true,
      date,
      entries,
      by_kind,
      aggregate,
      pillars,
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

    const created = await appendDailyLogEntries(user.id, logDate, toAppend);
    const { entries, by_kind, aggregate } = await buildDailyLogAggregate(user.id, logDate);

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
