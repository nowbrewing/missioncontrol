import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../../src/lib/auth";
import { pillarIdsForLogText } from "../../../../../src/lib/daily-log-pillar-tags";
import {
  buildDailyLogAggregate,
  deleteDailyLogEntry,
  updateDailyLogEntry,
  type DailyLogKind,
} from "../../../../../src/lib/daily-log-entries";
import { getDailyLogEntry } from "../../../../../src/lib/mongodb/store/daily-logs";
import { listPillars } from "../../../../../src/lib/mongodb/store/users";

type RouteContext = { params: Promise<{ id: string }> };

const TAGGED_KINDS = new Set<DailyLogKind>(["went_well", "daily_focus"]);

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { id: idParam } = await context.params;
    const entryId = Number(idParam);
    if (!Number.isFinite(entryId) || entryId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid entry id" }, { status: 400 });
    }

    const existing = await getDailyLogEntry(user.id, entryId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Entry not found" }, { status: 404 });
    }

    const body = (await req.json()) as { content?: string };
    const content = body.content?.trim() ?? "";
    if (!content) {
      return NextResponse.json(
        { ok: false, error: "Content cannot be empty — delete the entry instead" },
        { status: 400 }
      );
    }

    const contentChanged = content !== existing.content;
    let pillarIds: number[] | undefined;
    if (contentChanged && TAGGED_KINDS.has(existing.kind)) {
      const pillars = await listPillars(user.id);
      pillarIds = await pillarIdsForLogText(content, pillars);
    }

    const entry = await updateDailyLogEntry(
      user.id,
      entryId,
      content,
      pillarIds
    );
    if (!entry) {
      return NextResponse.json({ ok: false, error: "Entry not found" }, { status: 404 });
    }

    const { entries, by_kind, aggregate } = await buildDailyLogAggregate(
      user.id,
      existing.log_date
    );

    return NextResponse.json({
      ok: true,
      entry,
      date: existing.log_date,
      entries,
      by_kind,
      aggregate,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update entry";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { id: idParam } = await context.params;
    const entryId = Number(idParam);
    if (!Number.isFinite(entryId) || entryId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid entry id" }, { status: 400 });
    }

    const existing = await getDailyLogEntry(user.id, entryId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Entry not found" }, { status: 404 });
    }

    await deleteDailyLogEntry(user.id, entryId);

    const { entries, by_kind, aggregate } = await buildDailyLogAggregate(
      user.id,
      existing.log_date
    );

    return NextResponse.json({
      ok: true,
      date: existing.log_date,
      entries,
      by_kind,
      aggregate,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete entry";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
