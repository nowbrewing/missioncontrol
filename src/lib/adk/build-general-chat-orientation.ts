import { buildDailyLogAggregate, listDailyLogEntriesInRange } from "../daily-log-entries";
import { addDaysIsoYyyyMmDd } from "../date";
import { latestPillarContextSnippet } from "../pillar-context";
import { formatWeekRangeLabel } from "../reflection-week";
import { formatUserPreferencesForPrompt } from "../user-preferences";
import { listMilestones } from "../mongodb/store/milestones";
import { listTasks } from "../mongodb/store/tasks";
import { getUserPreferences, listPillars } from "../mongodb/store/users";

const MAX_MILESTONES_PER_PILLAR = 2;
const MAX_TODAY_TASKS = 5;
const MAX_OPEN_TASKS_PER_PILLAR = 3;
const PILLAR_SNIPPET_LEN = 120;

function latestWeeklySummaries(
  entries: { kind: string; content: string; log_date: string; week_monday?: string | null }[]
): string | null {
  const weekly = entries
    .filter((e) => e.kind === "weekly_summary" && e.content.trim())
    .sort((a, b) => b.log_date.localeCompare(a.log_date))
    .slice(0, 4);
  if (weekly.length === 0) return null;
  return weekly
    .map((e) => {
      const label = e.week_monday
        ? formatWeekRangeLabel(e.week_monday, e.log_date)
        : e.log_date;
      return `[Week of ${label}]\n${e.content.trim()}`;
    })
    .join("\n\n");
}

function latestDailyFocus(
  entries: { kind: string; content: string; log_date?: string }[]
): string | null {
  for (const entry of entries) {
    if (entry.kind === "daily_focus" && entry.content.trim()) {
      return entry.content.trim();
    }
  }
  return null;
}

export async function buildGeneralChatOrientation(userId: number, planDate: string) {
  const lookbackStart = addDaysIsoYyyyMmDd(planDate, -28);

  const [pillars, milestones, tasks, preferencesRaw, dailyLog, recentLogEntries] =
    await Promise.all([
      listPillars(userId),
      listMilestones(userId),
      listTasks(userId),
      getUserPreferences(userId),
      buildDailyLogAggregate(userId, planDate),
      listDailyLogEntriesInRange(userId, lookbackStart, planDate),
    ]);

  const sortedPillars = [...pillars].sort((a, b) => a.rank - b.rank);
  const openTasks = tasks.filter((t) => !t.completed_at);

  const pillarLines = sortedPillars.map((p) => {
    const pillarId = Number(p.id);
    const snippet = latestPillarContextSnippet(p.description, PILLAR_SNIPPET_LEN);
    const openMilestones = milestones
      .filter((m) => !m.completed_at && Number(m.pillar_id) === pillarId)
      .slice(0, MAX_MILESTONES_PER_PILLAR);
    const pillarTasks = openTasks
      .filter((t) => Number(t.pillar_id) === pillarId)
      .slice(0, MAX_OPEN_TASKS_PER_PILLAR);

    const parts: string[] = [`- #${p.rank} ${p.name}`];
    if (openMilestones.length > 0) {
      parts.push(`  Milestones: ${openMilestones.map((m) => m.title).join("; ")}`);
    }
    if (pillarTasks.length > 0) {
      parts.push(
        `  Open tasks: ${pillarTasks.map((t) => t.title).join("; ")}`
      );
    }
    if (snippet) {
      parts.push(`  Context: ${snippet}`);
    }
    return parts.join("\n");
  });

  const topOfMindToday = dailyLog.aggregate.daily_focus?.trim();
  const recentFocus = latestDailyFocus(
    [...recentLogEntries]
      .sort((a, b) => b.log_date.localeCompare(a.log_date))
      .map((e) => ({ kind: e.kind, content: e.content, log_date: e.log_date }))
  );

  const topOfMindBlock = topOfMindToday
    ? topOfMindToday
    : recentFocus
      ? `(no check-in today; recent focus from logs)\n${recentFocus}`
      : "(not checked in recently)";

  const weeklyReflections = latestWeeklySummaries(
    recentLogEntries.map((e) => ({
      kind: e.kind,
      content: e.content,
      log_date: e.log_date,
      week_monday: e.week_monday,
    }))
  );

  const dueToday = openTasks
    .filter((t) => t.deadline && String(t.deadline).slice(0, 10) <= planDate)
    .slice(0, MAX_TODAY_TASKS);

  const preferences = formatUserPreferencesForPrompt(preferencesRaw);
  const openTaskCount = openTasks.length;
  const openMilestoneCount = milestones.filter((m) => !m.completed_at).length;

  return `LIFE ORIENTATION — this IS what the user is juggling right now. Use it; do not ask them to repeat it.
Planning date: ${planDate}
Load: ${openTaskCount} open tasks, ${openMilestoneCount} open milestones across ${sortedPillars.length} pillars

Pillars:
${pillarLines.join("\n") || "(none)"}

Top of mind:
${topOfMindBlock}

Recent weekly reflections:
${weeklyReflections || "(none yet)"}

Due / overdue today:
${
  dueToday.length
    ? dueToday.map((t) => `- ${t.title}`).join("\n")
    : "(none)"
}

Working preferences:
${preferences || "(none)"}`;
}
