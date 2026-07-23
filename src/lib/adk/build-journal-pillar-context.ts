import { addDaysIsoYyyyMmDd } from "../date";
import {
  formatEntriesForPrompt,
  listDailyLogEntriesInRange,
} from "../daily-log-entries";
import { formatPillarContextForPrompt } from "../pillar-context";
import { listGoals } from "../mongodb/store/goals";
import { listMilestones } from "../mongodb/store/milestones";
import { listTasks } from "../mongodb/store/tasks";
import { listPillars } from "../mongodb/store/users";
import { listActiveRoutines } from "../mongodb/store/routines";
import { formatRoutineForPrompt } from "../routine-rules";

function formatMilestoneLine(m: {
  title: string;
  target_date: string | null;
  completed_at: string | null;
  status?: string | null;
}): string {
  const when = m.target_date ? ` target ${m.target_date}` : "";
  if (m.completed_at) {
    const doneDay = String(m.completed_at).slice(0, 10);
    return `- [done ${doneDay}] ${m.title}${when}`;
  }
  return `- [open] ${m.title}${when}`;
}

/** Deep pillar context for Journal when a specific pillar is selected. */
export async function buildJournalPillarContext(
  userId: number,
  planDate: string,
  pillarId: number
): Promise<{ pillarName: string; block: string } | null> {
  const lookbackStart = addDaysIsoYyyyMmDd(planDate, -90);

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

  const pillarMilestones = milestones
    .filter((m) => Number(m.pillar_id) === pillarId)
    .sort((a, b) => {
      const aDone = a.completed_at ? 1 : 0;
      const bDone = b.completed_at ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return String(a.target_date ?? "").localeCompare(String(b.target_date ?? ""));
    });

  const openMilestones = pillarMilestones.filter((m) => !m.completed_at);
  const doneMilestones = pillarMilestones.filter((m) => !!m.completed_at);

  const openTasks = tasks.filter(
    (t) => !t.completed_at && Number(t.pillar_id) === pillarId
  );
  const pillarGoals = goals.filter((g) => Number(g.pillar_id) === pillarId);
  const pillarRoutines = routines.filter((r) => Number(r.pillarId) === pillarId);
  const taggedLogs = logEntries.filter((e) => (e.pillar_ids ?? []).includes(pillarId));
  const contextNotes = formatPillarContextForPrompt(pillar.description);

  return {
    pillarName: String(pillar.name),
    block: `JOURNAL PILLAR CONTEXT — ${pillar.name} (id=${pillarId})

Pillar context notes (stacked history, newest first):
${contextNotes || "(none)"}

Current milestones (open):
${
  openMilestones.length
    ? openMilestones.map(formatMilestoneLine).join("\n")
    : "(none)"
}

Historical milestones (completed):
${
  doneMilestones.length
    ? doneMilestones.map(formatMilestoneLine).join("\n")
    : "(none)"
}

Open tasks:
${
  openTasks.length
    ? openTasks
        .map(
          (t) =>
            `- id=${t.id} "${t.title}"${t.deadline ? ` due ${t.deadline}` : ""}${
              t.note?.trim() ? ` — note: ${t.note.trim().slice(0, 100)}` : ""
            }`
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

Recent daily log entries tagged to this pillar (last ~90 days):
${formatEntriesForPrompt(taggedLogs) || "(none)"}`,
  };
}
