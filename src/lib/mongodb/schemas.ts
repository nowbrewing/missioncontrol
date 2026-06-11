import type { ObjectId } from "mongodb";
import type { RecurringKind, RecurringProgress } from "../recurring-week";
import type { MissionLayout } from "../mission-layout";

export type MongoPillar = {
  tursoId: number;
  name: string;
  description: string | null;
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
  active: boolean;
  rank: number;
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

export type DailyLogKind = "went_well" | "went_poorly" | "daily_focus";

export type MongoDailyLogEntry = {
  _id?: ObjectId;
  tursoId: number;
  tursoUserId: number;
  logDate: string;
  kind: DailyLogKind;
  content: string;
  /** Empty or omitted = general / cross-pillar win */
  pillarIds?: number[];
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
