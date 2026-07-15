import { formatPillarContextForPrompt } from "../../../pillar-context";
import { addDaysIsoYyyyMmDd } from "../../../date";
import {
  formatEntriesForPrompt,
  listDailyLogEntriesInRange,
} from "../../../daily-log-entries";
import { listGoals } from "../../../mongodb/store/goals";
import { listMilestones } from "../../../mongodb/store/milestones";
import { listTasks } from "../../../mongodb/store/tasks";
import { listPillars } from "../../../mongodb/store/users";
import { listActiveRoutines } from "../../../mongodb/store/routines";
import { formatRoutineForPrompt } from "../../../routine-rules";
import type { LightPillarRow } from "../../context/light-context";

/** Phase 2 (deterministic): load pillar-scoped data from MongoDB. */
export async function fetchPillarSkillContext(
  userId: number,
  planDate: string,
  pillarId: number
) {
  const lookbackStart = addDaysIsoYyyyMmDd(planDate, -28);

  const [pillars, goals, milestones, tasks, routines, logEntries] = await Promise.all([
    listPillars(userId),
    listGoals(userId),
    listMilestones(userId),
    listTasks(userId),
    listActiveRoutines(userId),
    listDailyLogEntriesInRange(userId, lookbackStart, planDate),
  ]);

  const pillar = pillars.find((p) => Number(p.id) === pillarId);
  if (!pillar) return null;

  const pillarGoals = goals.filter((g) => Number(g.pillar_id) === pillarId);
  const pillarMilestones = milestones.filter(
    (m) => Number(m.pillar_id) === pillarId && !m.completed_at
  );
  const pillarTasks = tasks.filter(
    (t) => !t.completed_at && Number(t.pillar_id) === pillarId
  );
  const pillarRoutines = routines.filter((r) => Number(r.pillarId) === pillarId);

  const taggedLogs = logEntries.filter((e) =>
    (e.pillar_ids ?? []).includes(pillarId)
  );

  const contextNotes = formatPillarContextForPrompt(pillar.description);

  return {
    pillarName: String(pillar.name),
    pillarId,
    block: `PILLAR: ${pillar.name} (id=${pillarId}, rank #${pillar.rank})

Context notes:
${contextNotes || "(none)"}

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
            `- id=${t.id} "${t.title}"${t.deadline ? ` due ${t.deadline}` : ""}${t.note?.trim() ? ` — note: ${t.note.trim().slice(0, 80)}` : ""}`
        )
        .join("\n")
    : "(none)"
}

Goals:
${pillarGoals.length ? pillarGoals.map((g) => `- ${g.title} (${g.status})`).join("\n") : "(none)"}

Routines:
${
  pillarRoutines.length
    ? pillarRoutines.map((r) => `- ${formatRoutineForPrompt(r)}`).join("\n")
    : "(none)"
}

Recent daily log entries tagged to this pillar (last 28 days):
${formatEntriesForPrompt(taggedLogs) || "(none)"}`,
  };
}

export function resolvePillarIdFromHint(
  hint: string | null,
  pillars: LightPillarRow[],
  message: string
): number | null {
  const haystack = `${hint ?? ""} ${message}`.toLowerCase();
  for (const p of pillars) {
    if (haystack.includes(p.name.toLowerCase())) return p.id;
    if (p.abbreviation && haystack.includes(p.abbreviation.toLowerCase())) {
      return p.id;
    }
  }
  return pillars[0]?.id ?? null;
}
