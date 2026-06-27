import { getMongoDb } from "../client";
import { nextLegacyId } from "../ids";
import { toSqlDatetime } from "../serialize";
import { isYyyyMmDd } from "../../date";
import {
  COLLECTIONS,
  type DailyLogKind,
  type MongoDailyLog,
  type MongoDailyLogEntry,
} from "../schemas";
import type { MissionLayout } from "../../mission-layout";

export type DailyLogEntry = {
  id: number;
  log_date: string;
  kind: DailyLogKind;
  content: string;
  pillar_ids: number[];
  week_monday: string | null;
  created_at: string;
};

function entryToRow(e: MongoDailyLogEntry): DailyLogEntry {
  return {
    id: e.tursoId,
    log_date: e.logDate,
    kind: e.kind,
    content: e.content,
    pillar_ids: e.pillarIds ?? [],
    week_monday: e.weekMonday ?? null,
    created_at: toSqlDatetime(e.createdAt),
  };
}

export async function ensureDailyLogRow(userId: number, logDate: string) {
  const db = await getMongoDb();
  const now = new Date();
  await db.collection<MongoDailyLog>(COLLECTIONS.daily_logs).updateOne(
    { tursoUserId: userId, logDate },
    {
      $setOnInsert: {
        tursoUserId: userId,
        logDate,
        wentWell: null,
        wentPoorly: null,
        dailyFocus: null,
        missionLayout: null,
        createdAt: now,
      },
      $set: { updatedAt: now },
    },
    { upsert: true }
  );
}

export async function getMissionLayout(
  userId: number,
  logDate: string
): Promise<MissionLayout | null> {
  const db = await getMongoDb();
  const row = await db.collection<MongoDailyLog>(COLLECTIONS.daily_logs).findOne({
    tursoUserId: userId,
    logDate,
  });
  return row?.missionLayout ?? null;
}

export async function upsertMissionLayout(
  userId: number,
  logDate: string,
  layout: MissionLayout
) {
  const db = await getMongoDb();
  const now = new Date();
  await db.collection<MongoDailyLog>(COLLECTIONS.daily_logs).updateOne(
    { tursoUserId: userId, logDate },
    {
      $set: { missionLayout: layout, updatedAt: now },
      $setOnInsert: {
        tursoUserId: userId,
        logDate,
        wentWell: null,
        wentPoorly: null,
        dailyFocus: null,
        createdAt: now,
      },
    },
    { upsert: true }
  );
}

export async function getRecentMissionLayoutDates(
  userId: number,
  beforeDate: string,
  limitDays: number
): Promise<string[]> {
  const db = await getMongoDb();
  const rows = await db
    .collection<MongoDailyLog>(COLLECTIONS.daily_logs)
    .find({
      tursoUserId: userId,
      logDate: { $lt: beforeDate },
      missionLayout: { $ne: null },
    })
    .sort({ logDate: -1 })
    .limit(limitDays)
    .toArray();
  return rows.map((r) => r.logDate);
}

async function backfillLegacyEntries(userId: number, logDate: string) {
  const db = await getMongoDb();
  const existing = await db
    .collection<MongoDailyLogEntry>(COLLECTIONS.daily_log_entries)
    .countDocuments({ tursoUserId: userId, logDate });
  if (existing > 0) return;

  const legacy = await db.collection<MongoDailyLog>(COLLECTIONS.daily_logs).findOne({
    tursoUserId: userId,
    logDate,
  });
  if (!legacy) return;

  const stamp = legacy.updatedAt;
  const pairs: [DailyLogKind, string | null][] = [
    ["went_well", legacy.wentWell],
    ["went_poorly", legacy.wentPoorly],
    ["daily_focus", legacy.dailyFocus],
  ];

  for (const [kind, content] of pairs) {
    if (!content?.trim()) continue;
    const tursoId = await nextLegacyId("daily_log_entry");
    const doc: MongoDailyLogEntry = {
      tursoId,
      tursoUserId: userId,
      logDate,
      kind,
      content: content.trim(),
      createdAt: stamp,
    };
    await db.collection<MongoDailyLogEntry>(COLLECTIONS.daily_log_entries).insertOne(doc);
  }
}

export async function appendDailyLogEntry(
  userId: number,
  logDate: string,
  kind: DailyLogKind,
  content: string,
  pillarIds?: number[],
  weekMonday?: string
): Promise<DailyLogEntry> {
  const text = content.trim();
  if (!text) throw new Error("Entry content is required");

  await ensureDailyLogRow(userId, logDate);
  const db = await getMongoDb();
  const tursoId = await nextLegacyId("daily_log_entry");
  const normalizedPillarIds = [...new Set(pillarIds ?? [])].sort((a, b) => a - b);
  const doc: MongoDailyLogEntry = {
    tursoId,
    tursoUserId: userId,
    logDate,
    kind,
    content: text,
    ...(normalizedPillarIds.length > 0 ? { pillarIds: normalizedPillarIds } : {}),
    ...(weekMonday && isYyyyMmDd(weekMonday) ? { weekMonday } : {}),
    createdAt: new Date(),
  };
  await db.collection<MongoDailyLogEntry>(COLLECTIONS.daily_log_entries).insertOne(doc);
  return entryToRow(doc);
}

export async function appendWentWellEntries(
  userId: number,
  logDate: string,
  statements: { content: string; pillar_ids?: number[] }[]
): Promise<DailyLogEntry[]> {
  const created: DailyLogEntry[] = [];
  for (const statement of statements) {
    const content = statement.content.trim();
    if (!content) continue;
    created.push(
      await appendDailyLogEntry(
        userId,
        logDate,
        "went_well",
        content,
        statement.pillar_ids
      )
    );
  }
  return created;
}

export async function listWentWellEntries(
  userId: number,
  since: string,
  before: string,
  pillarId?: number
): Promise<DailyLogEntry[]> {
  const db = await getMongoDb();
  const filter: Record<string, unknown> = {
    tursoUserId: userId,
    kind: "went_well",
    logDate: { $gte: since, $lte: before },
  };
  if (pillarId != null) {
    filter.pillarIds = pillarId;
  }

  const entries = await db
    .collection<MongoDailyLogEntry>(COLLECTIONS.daily_log_entries)
    .find(filter)
    .sort({ logDate: -1, createdAt: -1, tursoId: -1 })
    .toArray();

  return entries.map(entryToRow);
}

export async function getDailyLogEntry(
  userId: number,
  entryId: number
): Promise<DailyLogEntry | null> {
  const db = await getMongoDb();
  const entry = await db
    .collection<MongoDailyLogEntry>(COLLECTIONS.daily_log_entries)
    .findOne({ tursoUserId: userId, tursoId: entryId });
  return entry ? entryToRow(entry) : null;
}

export async function updateDailyLogEntry(
  userId: number,
  entryId: number,
  content: string,
  pillarIds?: number[] | null
): Promise<DailyLogEntry | null> {
  const text = content.trim();
  if (!text) return null;

  const db = await getMongoDb();
  const update: Record<string, unknown> = { content: text };
  const unset: Record<string, ""> = {};

  if (pillarIds !== undefined && pillarIds !== null) {
    if (pillarIds.length > 0) {
      update.pillarIds = [...new Set(pillarIds)].sort((a, b) => a - b);
    } else {
      unset.pillarIds = "";
    }
  }

  const result = await db
    .collection<MongoDailyLogEntry>(COLLECTIONS.daily_log_entries)
    .findOneAndUpdate(
      { tursoUserId: userId, tursoId: entryId },
      {
        ...(Object.keys(update).length > 0 ? { $set: update } : {}),
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
      { returnDocument: "after" }
    );
  return result ? entryToRow(result) : null;
}

export async function deleteDailyLogEntry(
  userId: number,
  entryId: number
): Promise<boolean> {
  const db = await getMongoDb();
  const result = await db
    .collection<MongoDailyLogEntry>(COLLECTIONS.daily_log_entries)
    .deleteOne({ tursoUserId: userId, tursoId: entryId });
  return result.deletedCount > 0;
}

export async function listDailyLogEntriesInRange(
  userId: number,
  fromDate: string,
  toDate: string
): Promise<DailyLogEntry[]> {
  const db = await getMongoDb();
  const entries = await db
    .collection<MongoDailyLogEntry>(COLLECTIONS.daily_log_entries)
    .find({
      tursoUserId: userId,
      logDate: { $gte: fromDate, $lte: toDate },
    })
    .sort({ logDate: -1, createdAt: 1, tursoId: 1 })
    .toArray();
  return entries.map(entryToRow);
}

export async function listDailyLogEntries(
  userId: number,
  logDate: string
): Promise<DailyLogEntry[]> {
  await backfillLegacyEntries(userId, logDate);
  const db = await getMongoDb();
  const entries = await db
    .collection<MongoDailyLogEntry>(COLLECTIONS.daily_log_entries)
    .find({ tursoUserId: userId, logDate })
    .sort({ createdAt: 1, tursoId: 1 })
    .toArray();
  return entries.map(entryToRow);
}

export async function listRecentDailyLogEntryDates(
  userId: number,
  beforeDate: string,
  limitDays: number
): Promise<string[]> {
  const db = await getMongoDb();
  const rows = await db
    .collection<MongoDailyLogEntry>(COLLECTIONS.daily_log_entries)
    .aggregate<{ logDate: string }>([
      { $match: { tursoUserId: userId, logDate: { $lt: beforeDate } } },
      { $group: { _id: "$logDate" } },
      { $sort: { _id: -1 } },
      { $limit: limitDays },
      { $project: { logDate: "$_id", _id: 0 } },
    ])
    .toArray();
  return rows.map((r) => r.logDate);
}

export async function listDailyLogMentions(
  userId: number,
  since: string,
  before: string
): Promise<string[]> {
  const db = await getMongoDb();
  const entries = await db
    .collection<MongoDailyLogEntry>(COLLECTIONS.daily_log_entries)
    .find({
      tursoUserId: userId,
      logDate: { $gte: since, $lt: before },
      kind: { $in: ["went_poorly", "daily_focus"] },
    })
    .toArray();
  return entries.map((e) => e.content);
}
