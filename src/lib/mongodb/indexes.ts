import type { Db } from "mongodb";
import { COLLECTIONS } from "./schemas";

export async function ensureMongoIndexes(db: Db) {
  await Promise.all([
    db.collection(COLLECTIONS.users).createIndex({ tursoId: 1 }, { unique: true }),
    db.collection(COLLECTIONS.users).createIndex({ email: 1 }, { unique: true }),
    db.collection(COLLECTIONS.sessions).createIndex({ token: 1 }, { unique: true }),
    db.collection(COLLECTIONS.sessions).createIndex({ tursoUserId: 1 }),
    db.collection(COLLECTIONS.sessions).createIndex({ expiresAt: 1 }),
    db.collection(COLLECTIONS.goals).createIndex({ tursoUserId: 1, tursoId: 1 }, { unique: true }),
    db.collection(COLLECTIONS.milestones).createIndex({ tursoUserId: 1, tursoId: 1 }, { unique: true }),
    db.collection(COLLECTIONS.milestones).createIndex({ tursoUserId: 1, status: 1 }),
    db
      .collection(COLLECTIONS.tasks)
      .createIndex({ tursoUserId: 1, tursoId: 1 }, { unique: true, sparse: true }),
    db.collection(COLLECTIONS.tasks).createIndex({ tursoUserId: 1, bucket: 1, status: 1 }),
    db.collection(COLLECTIONS.tasks).createIndex({ tursoUserId: 1, recurringEventId: 1, recurringWeekMonday: 1 }),
    db.collection(COLLECTIONS.routines).createIndex({ tursoUserId: 1, tursoId: 1 }, { unique: true }),
    db
      .collection(COLLECTIONS.routine_progress)
      .createIndex({ tursoUserId: 1, routineId: 1, weekMonday: 1 }, { unique: true }),
    db
      .collection(COLLECTIONS.routine_progress)
      .createIndex({ tursoUserId: 1, tursoId: 1 }, { unique: true }),
    db
      .collection(COLLECTIONS.daily_logs)
      .createIndex({ tursoUserId: 1, logDate: 1 }, { unique: true }),
    db
      .collection(COLLECTIONS.daily_log_entries)
      .createIndex({ tursoUserId: 1, tursoId: 1 }, { unique: true }),
    db
      .collection(COLLECTIONS.daily_log_entries)
      .createIndex({ tursoUserId: 1, logDate: 1 }),
  ]);
}
