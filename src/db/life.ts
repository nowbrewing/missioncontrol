import type { Client } from "@libsql/client";

const LIFE_TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS pillars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#FF6F61',
    rank INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pillar_id INTEGER NOT NULL REFERENCES pillars(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target_date TEXT,
    rank INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
    pillar_id INTEGER REFERENCES pillars(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target_date TEXT,
    rank INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date TEXT NOT NULL,
    went_well TEXT,
    went_poorly TEXT,
    daily_focus TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, log_date)
  );`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    deadline TEXT,
    completed_at TEXT,
    rank INTEGER NOT NULL DEFAULT 0,
    pillar_id INTEGER REFERENCES pillars(id) ON DELETE SET NULL,
    milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
    schedule_type TEXT NOT NULL DEFAULT 'flexible',
    window_start TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS recurring_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    target_count INTEGER NOT NULL DEFAULT 1,
    daily_days TEXT,
    pillar_id INTEGER REFERENCES pillars(id) ON DELETE SET NULL,
    milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
    spawn_task_cards INTEGER NOT NULL DEFAULT 0,
    tally_enabled INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    rank INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS daily_log_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date TEXT NOT NULL,
    kind TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS recurring_weekly_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recurring_event_id INTEGER NOT NULL REFERENCES recurring_events(id) ON DELETE CASCADE,
    week_monday TEXT NOT NULL,
    progress TEXT NOT NULL DEFAULT '{}',
    tasks_spawned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, recurring_event_id, week_monday)
  );`,
];

const LIFE_INDEX_STATEMENTS = [
  `CREATE INDEX IF NOT EXISTS idx_pillars_user_id ON pillars(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_goals_pillar_id ON goals(pillar_id);`,
  `CREATE INDEX IF NOT EXISTS idx_milestones_goal_id ON milestones(goal_id);`,
  `CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, log_date);`,
  `CREATE INDEX IF NOT EXISTS idx_daily_log_entries_user_date ON daily_log_entries(user_id, log_date);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_recurring_events_user_id ON recurring_events(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_recurring_weekly_progress_user_week ON recurring_weekly_progress(user_id, week_monday);`,
];

type MilestoneColumnInfo = { name: string; notnull: number };

function parseMilestoneColumns(info: { rows: unknown[] }): MilestoneColumnInfo[] {
  return ((info.rows as Record<string, unknown>[]) ?? []).map((r) => ({
    name: String(r.name),
    notnull: Number(r.notnull),
  }));
}

const MILESTONES_NEW_DDL = `CREATE TABLE milestones_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
  pillar_id INTEGER REFERENCES pillars(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_date TEXT,
  rank INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

async function migrateMilestonesSchema(turso: Client) {
  const info = await turso.execute({ sql: "PRAGMA table_info('milestones');" });
  if (info.rows.length === 0) return;

  const cols = parseMilestoneColumns(info);
  const hasPillarId = cols.some((c) => c.name === "pillar_id");
  const goalIdNotNull = cols.find((c) => c.name === "goal_id")?.notnull === 1;

  if (hasPillarId && !goalIdNotNull) return;

  const pillarIdExpr = hasPillarId
    ? "COALESCE(m.pillar_id, g.pillar_id)"
    : "g.pillar_id";

  await turso.execute(MILESTONES_NEW_DDL);
  await turso.execute(`INSERT INTO milestones_new
    (id, user_id, goal_id, pillar_id, title, target_date, rank, completed_at, created_at)
    SELECT m.id, m.user_id, m.goal_id, ${pillarIdExpr}, m.title, m.target_date, m.rank, m.completed_at, m.created_at
    FROM milestones m
    LEFT JOIN goals g ON g.id = m.goal_id;`);
  await turso.execute(`DROP TABLE milestones;`);
  await turso.execute(`ALTER TABLE milestones_new RENAME TO milestones;`);
  await turso.execute(
    `CREATE INDEX IF NOT EXISTS idx_milestones_goal_id ON milestones(goal_id);`
  );
  await turso.execute(
    `CREATE INDEX IF NOT EXISTS idx_milestones_pillar_id ON milestones(pillar_id);`
  );
}

async function migrateTasksMilestoneId(turso: Client) {
  const info = await turso.execute({ sql: "PRAGMA table_info('tasks');" });
  if (info.rows.length === 0) return;

  const cols = new Set(
    ((info.rows as Record<string, unknown>[]) ?? []).map((r) => String(r.name))
  );
  if (!cols.has("milestone_id")) {
    await turso.execute(
      `ALTER TABLE tasks ADD COLUMN milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL;`
    );
  }
  await turso.execute(
    `CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON tasks(milestone_id);`
  );
}

async function migrateTasksSchedule(turso: Client) {
  const info = await turso.execute({ sql: "PRAGMA table_info('tasks');" });
  if (info.rows.length === 0) return;

  const cols = new Set(
    ((info.rows as Record<string, unknown>[]) ?? []).map((r) => String(r.name))
  );
  if (!cols.has("schedule_type")) {
    await turso.execute(
      `ALTER TABLE tasks ADD COLUMN schedule_type TEXT NOT NULL DEFAULT 'flexible';`
    );
  }
  if (!cols.has("window_start")) {
    await turso.execute(`ALTER TABLE tasks ADD COLUMN window_start TEXT;`);
  }
}

async function migrateDailyLogsMissionLayout(turso: Client) {
  const info = await turso.execute({ sql: "PRAGMA table_info('daily_logs');" });
  if (info.rows.length === 0) return;

  const cols = new Set(
    ((info.rows as Record<string, unknown>[]) ?? []).map((r) => String(r.name))
  );
  if (cols.has("mission_layout")) return;

  await turso.execute(`ALTER TABLE daily_logs ADD COLUMN mission_layout TEXT;`);
}

async function migratePillarsColor(turso: Client) {
  const info = await turso.execute({ sql: "PRAGMA table_info('pillars');" });
  if (info.rows.length === 0) return;

  const cols = new Set(
    ((info.rows as Record<string, unknown>[]) ?? []).map((r) => String(r.name))
  );
  if (cols.has("color")) return;

  await turso.execute(
    `ALTER TABLE pillars ADD COLUMN color TEXT NOT NULL DEFAULT '#FF6F61';`
  );
}

async function migrateTasksRecurring(turso: Client) {
  const info = await turso.execute({ sql: "PRAGMA table_info('tasks');" });
  if (info.rows.length === 0) return;

  const cols = new Set(
    ((info.rows as Record<string, unknown>[]) ?? []).map((r) => String(r.name))
  );
  if (!cols.has("recurring_event_id")) {
    await turso.execute(
      `ALTER TABLE tasks ADD COLUMN recurring_event_id INTEGER REFERENCES recurring_events(id) ON DELETE SET NULL;`
    );
  }
  if (!cols.has("recurring_week_monday")) {
    await turso.execute(`ALTER TABLE tasks ADD COLUMN recurring_week_monday TEXT;`);
  }
  if (!cols.has("recurring_slot")) {
    await turso.execute(`ALTER TABLE tasks ADD COLUMN recurring_slot TEXT;`);
  }
}

async function migratePillarsAbbreviation(turso: Client) {
  const info = await turso.execute({ sql: "PRAGMA table_info('pillars');" });
  if (info.rows.length === 0) return;

  const cols = new Set(
    ((info.rows as Record<string, unknown>[]) ?? []).map((r) => String(r.name))
  );
  if (cols.has("abbreviation")) return;

  await turso.execute(`ALTER TABLE pillars ADD COLUMN abbreviation TEXT;`);
}

async function migrateRecurringTally(turso: Client) {
  const info = await turso.execute({ sql: "PRAGMA table_info('recurring_events');" });
  if (info.rows.length === 0) return;

  const cols = new Set(
    ((info.rows as Record<string, unknown>[]) ?? []).map((r) => String(r.name))
  );
  if (!cols.has("tally_enabled")) {
    await turso.execute(
      `ALTER TABLE recurring_events ADD COLUMN tally_enabled INTEGER NOT NULL DEFAULT 0;`
    );
  }

  await turso.execute({
    sql: `UPDATE recurring_events SET kind = 'daily', tally_enabled = 1,
          daily_days = COALESCE(daily_days, ?)
          WHERE kind = 'counter';`,
    args: [JSON.stringify([true, true, true, true, true, true, true])],
  });
}

export async function ensureLifeSchema(turso: Client) {
  for (const sql of LIFE_TABLE_STATEMENTS) {
    await turso.execute(sql);
  }
  for (const sql of LIFE_INDEX_STATEMENTS) {
    await turso.execute(sql);
  }
  await migrateMilestonesSchema(turso);
  await migratePillarsColor(turso);
  await migratePillarsAbbreviation(turso);
  await migrateTasksMilestoneId(turso);
  await migrateDailyLogsMissionLayout(turso);
  await migrateTasksSchedule(turso);
  await migrateTasksRecurring(turso);
  await migrateRecurringTally(turso);
}

export type PillarRow = {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  abbreviation: string | null;
  color: string;
  rank: number;
  created_at: string;
};

export type GoalRow = {
  id: number;
  user_id: number;
  pillar_id: number;
  title: string;
  target_date: string | null;
  rank: number;
  status: string;
  created_at: string;
};

export type MilestoneRow = {
  id: number;
  user_id: number;
  goal_id: number | null;
  pillar_id: number | null;
  title: string;
  target_date: string | null;
  rank: number;
  completed_at: string | null;
  created_at: string;
};

export type DailyLogRow = {
  id: number;
  user_id: number;
  log_date: string;
  went_well: string | null;
  went_poorly: string | null;
  daily_focus: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  deadline: string | null;
  completed_at: string | null;
  rank: number;
  pillar_id: number | null;
  milestone_id: number | null;
  schedule_type: string;
  window_start: string | null;
  created_at: string;
};
