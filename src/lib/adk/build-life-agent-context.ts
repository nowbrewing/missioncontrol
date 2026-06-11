import { formatPillarContextForPrompt } from "../pillar-context";
import { addDaysIsoYyyyMmDd } from "../date";
import {
  formatEntriesForPrompt,
  groupEntriesByKind,
  listRecentDailyLogEntries,
} from "../daily-log-entries";
import { formatUserPreferencesForPrompt } from "../user-preferences";
import { listGoals } from "../mongodb/store/goals";
import { listMilestones } from "../mongodb/store/milestones";
import { listActiveRoutines } from "../mongodb/store/routines";
import { listTasks } from "../mongodb/store/tasks";
import { getUserPreferences, listPillars } from "../mongodb/store/users";
import { LIFE_ADMIN_PILLAR_NAME } from "../life-admin";
import { listWentWellEntries } from "../mongodb/store/daily-logs";
import { formatWentWellEntriesForPrompt } from "../went-well-context";

export async function buildLifeAgentSystemContext(userId: number, planDate: string) {
  const since = addDaysIsoYyyyMmDd(planDate, -7);
  const [pillars, goals, milestones, tasks, routines, preferencesRaw, recentLogs, wentWellEntries] =
    await Promise.all([
      listPillars(userId),
      listGoals(userId),
      listMilestones(userId),
      listTasks(userId),
      listActiveRoutines(userId),
      getUserPreferences(userId),
      listRecentDailyLogEntries(userId, planDate, 7),
      listWentWellEntries(userId, since, planDate),
    ]);

  const pillarById = new Map(pillars.map((p) => [Number(p.id), String(p.name)]));

  const openTasks = tasks.filter((t) => !t.completed_at);
  const completedRecent = tasks.filter((t) => {
    if (!t.completed_at) return false;
    const completedDate = String(t.completed_at).slice(0, 10);
    return completedDate >= since && completedDate <= planDate;
  });

  const openMilestones = milestones.filter((m) => !m.completed_at);

  const pillarList = pillars
    .map((p) => {
      const context = formatPillarContextForPrompt(p.description);
      if (!context) return `- id=${p.id} name="${p.name}"`;
      return `- id=${p.id} name="${p.name}"\n  context:\n${context
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n")}`;
    })
    .join("\n");

  const goalList = goals
    .map(
      (g) =>
        `- id=${g.id} pillar_id=${g.pillar_id} title="${g.title}" status=${g.status}`
    )
    .join("\n");

  const milestoneList = openMilestones
    .map((m) => {
      const pillarName =
        m.pillar_id != null
          ? pillarById.get(Number(m.pillar_id)) ?? "none"
          : LIFE_ADMIN_PILLAR_NAME;
      return `- id=${m.id} title="${m.title}" pillar=${pillarName} target=${m.target_date ?? "none"}`;
    })
    .join("\n");

  const existingTasks = openTasks
    .map((t) => {
      const pillarName =
        t.pillar_id != null
          ? pillarById.get(Number(t.pillar_id)) ?? "none"
          : LIFE_ADMIN_PILLAR_NAME;
      const locked = Number(t.date_locked) === 1 ? " date_locked=true" : "";
      const schedule = t.schedule_type ? ` schedule=${t.schedule_type}` : "";
      return `- id=${t.id} title="${t.title}" pillar=${pillarName} deadline=${t.deadline ?? "none"}${schedule}${locked}`;
    })
    .join("\n");

  const completionHistory = completedRecent
    .map((t) => {
      const pillarName =
        t.pillar_id != null
          ? pillarById.get(Number(t.pillar_id)) ?? "none"
          : LIFE_ADMIN_PILLAR_NAME;
      const completedDate = String(t.completed_at).slice(0, 10);
      return `- ${completedDate}: "${t.title}" (pillar: ${pillarName})`;
    })
    .join("\n");

  const routineList = routines
    .map(
      (r) =>
        `- id=${r.tursoId} title="${r.title}" kind=${r.kind} target=${r.targetFrequency}`
    )
    .join("\n");

  const recentCheckIns = recentLogs
    .map(({ log_date, entries }) => {
      const byKind = groupEntriesByKind(entries);
      const parts = [
        formatEntriesForPrompt(byKind.daily_focus),
        formatEntriesForPrompt(byKind.went_poorly),
      ].filter(Boolean);
      if (parts.length === 0) return null;
      return `${log_date}:\n${parts.join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const preferences = formatUserPreferencesForPrompt(preferencesRaw);

  const wentWellByPillar = formatWentWellEntriesForPrompt(
    wentWellEntries,
    pillars.map((p) => ({ id: Number(p.id), name: String(p.name) }))
  );

  return `SYSTEM CONTEXT
User ID (pass as user_id to all MCP tools): ${userId}
Planning date: ${planDate}
Lookback window: ${since} through ${planDate}

USER PILLARS:
${pillarList || "(none)"}

GOALS:
${goalList || "(none)"}

OPEN MILESTONES:
${milestoneList || "(none)"}

ACTIVE WEEKLY ROUTINES:
${routineList || "(none)"}

EXISTING OPEN TASKS:
${existingTasks || "(none)"}

COMPLETION HISTORY (LAST 7 DAYS):
${completionHistory || "(no completions in this window)"}

RECENT DAILY LOG ENTRIES (LAST 7 DAYS — brain dumps and struggles only):
${recentCheckIns || "(none)"}

RECENT WINS (LAST 7 DAYS — tagged by pillar for reflection; not task completions):
${wentWellByPillar}

USER PREFERENCES:
${preferences || "(none)"}`;
}
