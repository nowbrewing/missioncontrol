import { formatPillarContextForPrompt } from "../pillar-context";
import { addDaysIsoYyyyMmDd } from "../date";
import {
  formatEntriesForPrompt,
  groupEntriesByKind,
  listDailyLogEntriesInRange,
} from "../daily-log-entries";
import { formatUserPreferencesForPrompt } from "../user-preferences";
import { listGoals } from "../mongodb/store/goals";
import { listMilestones } from "../mongodb/store/milestones";
import { listTasks } from "../mongodb/store/tasks";
import { getUserPreferences, listPillars } from "../mongodb/store/users";
import { listActiveRoutines } from "../mongodb/store/routines";
import { formatRoutineForPrompt } from "../routine-rules";
import { LIFE_ADMIN_PILLAR_NAME } from "../life-admin";
import { listWentWellEntries } from "../mongodb/store/daily-logs";
import { formatWentWellEntriesForPrompt } from "../went-well-context";
import type { OpenChatContextPlan } from "./classify-open-chat-context";

function entryMatchesPillars(pillarIds: number[], entryPillarIds: number[]) {
  if (pillarIds.length === 0) return true;
  if (entryPillarIds.length === 0) return false;
  return entryPillarIds.some((id) => pillarIds.includes(id));
}

export async function buildOpenChatContext(
  userId: number,
  planDate: string,
  plan: OpenChatContextPlan
) {
  const since = addDaysIsoYyyyMmDd(planDate, -(plan.lookback_days - 1));
  const focusedSet = new Set(plan.focused_pillar_ids);

  const [pillars, goals, milestones, tasks, preferencesRaw, routines, logEntries, wentWellEntries] =
    await Promise.all([
      listPillars(userId),
      listGoals(userId),
      listMilestones(userId),
      listTasks(userId),
      getUserPreferences(userId),
      listActiveRoutines(userId),
      listDailyLogEntriesInRange(userId, since, planDate),
      listWentWellEntries(userId, since, planDate),
    ]);

  const pillarById = new Map(pillars.map((p) => [Number(p.id), String(p.name)]));

  const pillarOverview = pillars
    .map((p) => `- #${p.rank} id=${p.id} "${p.name}"`)
    .join("\n");

  const focusedPillars = pillars.filter((p) => focusedSet.has(Number(p.id)));
  const focusedBlocks = focusedPillars
    .map((pillar) => {
      const pillarId = Number(pillar.id);
      const context = formatPillarContextForPrompt(pillar.description);
      const pillarGoals = goals.filter((g) => Number(g.pillar_id) === pillarId);
      const pillarMilestones = milestones.filter(
        (m) => Number(m.pillar_id) === pillarId && !m.completed_at
      );
      const pillarTasks = tasks.filter(
        (t) => !t.completed_at && Number(t.pillar_id) === pillarId
      );

      return `### ${pillar.name} (id=${pillarId})
${context ? `Context notes:\n${context}` : "(no stacked context yet)"}

Open milestones:
${
  pillarMilestones.length
    ? pillarMilestones
        .map((m) => `- ${m.title}${m.target_date ? ` (target ${m.target_date})` : ""}`)
        .join("\n")
    : "(none)"
}

Open tasks:
${
  pillarTasks.length
    ? pillarTasks
        .map(
          (t) =>
            `- id=${t.id} ${t.title}${t.deadline ? ` — due ${t.deadline}` : ""}`
        )
        .join("\n")
    : "(none)"
}

Goals:
${
  pillarGoals.length
    ? pillarGoals.map((g) => `- ${g.title} (${g.status})`).join("\n")
    : "(none)"
}`;
    })
    .join("\n\n");

  const openTaskCount = tasks.filter((t) => !t.completed_at).length;
  const openTasksIndex = tasks
    .filter((t) => !t.completed_at)
    .slice(0, 40)
    .map((t) => {
      const pillarName =
        t.pillar_id != null
          ? pillarById.get(Number(t.pillar_id)) ?? LIFE_ADMIN_PILLAR_NAME
          : LIFE_ADMIN_PILLAR_NAME;
      return `- id=${t.id} "${t.title}" (${pillarName})${t.deadline ? ` due ${t.deadline}` : ""}`;
    })
    .join("\n");

  const routinesBlock = routines
    .map((r) => formatRoutineForPrompt(r, { includeId: true }))
    .join("\n");

  const boardSnapshot = `- ${openTaskCount} open tasks across all pillars (board not re-sorted in chat)`;

  const logsByDate = new Map<string, typeof logEntries>();
  for (const entry of logEntries) {
    if (!entryMatchesPillars(plan.focused_pillar_ids, entry.pillar_ids)) continue;
    const bucket = logsByDate.get(entry.log_date) ?? [];
    bucket.push(entry);
    logsByDate.set(entry.log_date, bucket);
  }

  const dailyLogBlock = [...logsByDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([logDate, entries]) => {
      const byKind = groupEntriesByKind(entries);
      const parts = [
        byKind.went_well.length
          ? `Looking back:\n${formatEntriesForPrompt(byKind.went_well)}`
          : null,
        byKind.daily_focus.length
          ? `Looking ahead:\n${formatEntriesForPrompt(byKind.daily_focus)}`
          : null,
        byKind.assistant_chat.length
          ? `Assistant chat:\n${formatEntriesForPrompt(byKind.assistant_chat)}`
          : null,
        byKind.went_poorly.length
          ? `Struggles:\n${formatEntriesForPrompt(byKind.went_poorly)}`
          : null,
      ].filter(Boolean);
      return `${logDate}:\n${parts.join("\n")}`;
    })
    .join("\n\n");

  const filteredWentWell =
    plan.focused_pillar_ids.length > 0
      ? wentWellEntries.filter((row) =>
          entryMatchesPillars(plan.focused_pillar_ids, row.pillar_ids ?? [])
        )
      : wentWellEntries;

  const winsBlock = formatWentWellEntriesForPrompt(
    filteredWentWell,
    pillars.map((p) => ({ id: Number(p.id), name: String(p.name) }))
  );

  const recentCompletions = tasks
    .filter((t) => {
      if (!t.completed_at) return false;
      const d = String(t.completed_at).slice(0, 10);
      if (d < since || d > planDate) return false;
      if (plan.focused_pillar_ids.length === 0) return true;
      return plan.focused_pillar_ids.includes(Number(t.pillar_id));
    })
    .slice(0, 12)
    .map((t) => {
      const pillarName =
        t.pillar_id != null
          ? pillarById.get(Number(t.pillar_id)) ?? LIFE_ADMIN_PILLAR_NAME
          : LIFE_ADMIN_PILLAR_NAME;
      return `- ${String(t.completed_at).slice(0, 10)}: "${t.title}" (${pillarName})`;
    })
    .join("\n");

  const preferences = formatUserPreferencesForPrompt(preferencesRaw);

  const focusLine =
    plan.focused_pillar_ids.length > 0
      ? `Focused pillars this turn: ${plan.focused_pillar_ids
          .map((id) => pillarById.get(id) ?? id)
          .join(", ")}`
      : "Focused pillars: none detected (general conversation)";

  return `SYSTEM CONTEXT — open assistant chat
Planning date: ${planDate}
Lookback window: ${since} through ${planDate} (${plan.lookback_days} days)
${focusLine}

PILLARS (overview):
${pillarOverview || "(none)"}

${focusedBlocks ? `FOCUSED PILLAR DETAIL:\n${focusedBlocks}` : ""}

BOARD SNAPSHOT:
${boardSnapshot}

OPEN TASKS (for edits — use id in task_edits):
${openTasksIndex || "(none)"}

ROUTINES (weekly habits — each may include scheduling rules):
${routinesBlock || "(none)"}

DAILY LOG (${plan.lookback_days}-day window${plan.focused_pillar_ids.length ? ", filtered to focused pillars where tagged" : ""}):
${dailyLogBlock || "(no matching log entries in this window)"}

RECENT WINS (same window):
${winsBlock || "(none)"}

RECENT COMPLETIONS (same window):
${recentCompletions || "(none)"}

USER PREFERENCES:
${preferences || "(none)"}`;
}
