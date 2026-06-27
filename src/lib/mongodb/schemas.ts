import type { ObjectId } from "mongodb";
import type { PillarNoteFieldDef, PillarNoteFieldValues } from "../pillar-note-fields";
import type { RecurringKind, RecurringProgress } from "../recurring-week";
import type { MissionLayout } from "../mission-layout";

export type MongoPillar = {
  tursoId: number;
  name: string;
  description: string | null;
  /** Quick scheduling reminders shown on the pillar calendar (e.g. "Mondays: deep work"). */
  calendarNote: string | null;
  /** Pillar-specific structured fields shown under the planning note (e.g. Theme, Style). */
  noteFields: PillarNoteFieldDef[];
  noteFieldValues: PillarNoteFieldValues;
  color: string;
  abbreviation: string | null;
  rank: number;
  createdAt: Date;
};

export type MongoUser = {
  _id?: ObjectId;
  tursoId: number;
  email: string;
  name: string;
  passwordHash: string;
  preferences: string | null;
  routineRules: string | null;
  pillars: MongoPillar[];
  createdAt: Date;
};

export type MongoSession = {
  _id?: ObjectId;
  tursoId: number;
  userId: ObjectId;
  tursoUserId: number;
  token: string;
  expiresAt: Date;
  createdAt: Date;
};

export type MongoGoal = {
  _id?: ObjectId;
  tursoId: number;
  tursoUserId: number;
  pillarId: number;
  title: string;
  targetDate: string | null;
  rank: number;
  status: string;
  createdAt: Date;
};

export type MilestoneStatus = "in_progress" | "completed";

export type MongoMilestone = {
  _id?: ObjectId;
  tursoId: number;
  userId: ObjectId;
  tursoUserId: number;
  pillarId: number | null;
  goalId: number | null;
  title: string;
  deadline: Date | null;
  rank: number;
  status: MilestoneStatus;
  completedAt: Date | null;
  createdAt: Date;
};

export type TaskBucket = "Today" | "Tomorrow" | "Week" | "Later";
export type TaskStatus = "pending" | "completed";

export type MongoTask = {
  _id?: ObjectId;
  tursoId: number;
  userId: ObjectId;
  tursoUserId: number;
  pillarId: number | null;
  milestoneId: number | null;
  title: string;
  description: string | null;
  note: string | null;
  deadline: Date | null;
  bucket: TaskBucket | null;
  status: TaskStatus;
  rank: number;
  scheduleType: string;
  windowStart: string | null;
  recurringEventId: number | null;
  recurringWeekMonday: string | null;
  recurringSlot: string | null;
  isNew: boolean;
  /** Undated capture — excluded from calendar and mission prioritization until scheduled. */
  isIdea: boolean;
  dateLocked: boolean;
  completedAt: Date | null;
  createdAt: Date;
};

export type MongoRoutine = {
  _id?: ObjectId;
  tursoId: number;
  userId: ObjectId;
  tursoUserId: number;
  pillarId: number | null;
  milestoneId: number | null;
  title: string;
  kind: RecurringKind;
  targetFrequency: number;
  dailyDays: boolean[];
  tallyEnabled: boolean;
  spawnTaskCards: boolean;
  /** Last calendar day for spawned tasks — null means ongoing (4-week rolling horizon). */
  endDate: string | null;
  active: boolean;
  rank: number;
  rules: string | null;
  createdAt: Date;
};

export type MongoRoutineProgress = {
  _id?: ObjectId;
  tursoId: number;
  tursoUserId: number;
  routineId: number;
  weekMonday: string;
  progress: RecurringProgress;
  tasksSpawned: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MongoDailyLog = {
  _id?: ObjectId;
  tursoUserId: number;
  logDate: string;
  wentWell: string | null;
  wentPoorly: string | null;
  dailyFocus: string | null;
  missionLayout: MissionLayout | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DailyLogKind =
  | "went_well"
  | "went_poorly"
  | "daily_focus"
  | "assistant_chat"
  | "weekly_summary";

export type MongoDailyLogEntry = {
  _id?: ObjectId;
  tursoId: number;
  tursoUserId: number;
  logDate: string;
  kind: DailyLogKind;
  content: string;
  /** Empty or omitted = general / cross-pillar win */
  pillarIds?: number[];
  /** Monday (YYYY-MM-DD) of the week this summary covers — weekly_summary only */
  weekMonday?: string;
  createdAt: Date;
};

export const COLLECTIONS = {
  counters: "counters",
  users: "users",
  sessions: "sessions",
  goals: "goals",
  milestones: "milestones",
  tasks: "tasks",
  routines: "routines",
  routine_progress: "routine_progress",
  daily_logs: "daily_logs",
  daily_log_entries: "daily_log_entries",
} as const;
