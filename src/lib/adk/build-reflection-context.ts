import type {
  WeekRecap,
  WeekRecapPillar,
} from "../build-week-recap";
import { isLifeAdminPillarName } from "../life-admin";
import {
  collapsePillarTaskLines,
  formatRoutineSynthesis,
} from "../reflection-routine-lines";
import { routineProgressScore } from "../recurring-events";
import { formatWeekRangeLabel, formatWeekRangeLong } from "../reflection-week";

function mergeGeneralIntoLifeAdmin(pillar: WeekRecapPillar, recap: WeekRecap): WeekRecapPillar {
  if (!isLifeAdminPillarName(pillar.name)) return pillar;
  const g = recap.general;
  return {
    ...pillar,
    scheduled: [...pillar.scheduled, ...g.scheduled],
    completed: [...pillar.completed, ...g.completed],
    missed: [...pillar.missed, ...g.missed],
    logs: {
      went_well: [...pillar.logs.went_well, ...g.logs.went_well],
      went_poorly: [...pillar.logs.went_poorly, ...g.logs.went_poorly],
      daily_focus: [...pillar.logs.daily_focus, ...g.logs.daily_focus],
    },
  };
}

function effectivePillars(recap: WeekRecap): WeekRecapPillar[] {
  return recap.pillars
    .map((p) => mergeGeneralIntoLifeAdmin(p, recap))
    .sort((a, b) => a.rank - b.rank);
}

function pillarNamesByRank(pillars: WeekRecapPillar[]): string {
  return [...pillars].sort((a, b) => a.rank - b.rank).map((p) => p.name).join(", ");
}

function hasLifeAdminPillar(recap: WeekRecap): boolean {
  return recap.pillars.some((p) => isLifeAdminPillarName(p.name));
}

function pillarHadActivity(pillar: WeekRecapPillar, recap: WeekRecap): boolean {
  const routineHits = recap.routines.some((r) => {
    if (r.pillar_id !== pillar.id) return false;
    const score = routineProgressScore(r);
    return score.done > 0 || (score.target > 0 && score.done < score.target);
  });

  return (
    routineHits ||
    pillar.scheduled.length > 0 ||
    pillar.completed.length > 0 ||
    pillar.missed.length > 0 ||
    pillar.logs.went_well.length > 0
  );
}

function quietPillars(recap: WeekRecap): WeekRecapPillar[] {
  return effectivePillars(recap).filter((p) => !pillarHadActivity(p, recap));
}

function formatLifeAdminMiss(pillar: WeekRecapPillar, recap: WeekRecap): string | null {
  const lines = collapsePillarTaskLines(
    pillar.missed,
    recap.routines,
    recap.week_monday,
    pillar.id,
    "missed"
  );
  if (lines.length > 0) return lines.join("\n");
  if (pillar.missed.length === 0) return null;
  return "- Still have items open.";
}

function formatPillarTaskLines(
  recap: WeekRecap,
  pillar: WeekRecapPillar,
  field: "completed" | "missed"
): string {
  const tasks = field === "completed" ? pillar.completed : pillar.missed;
  return collapsePillarTaskLines(
    tasks,
    recap.routines,
    recap.week_monday,
    pillar.id,
    field
  ).join("\n");
}

function formatPillarGroupedBucket(
  recap: WeekRecap,
  field: "completed" | "missed"
): string {
  const blocks: string[] = [];

  for (const pillar of effectivePillars(recap)) {
    if (isLifeAdminPillarName(pillar.name)) {
      if (field === "completed") {
        const lines = collapsePillarTaskLines(
          pillar.completed,
          recap.routines,
          recap.week_monday,
          pillar.id,
          "completed"
        );
        if (lines.length === 0) continue;
        const hasRoutineLine = lines.some((line) => line.includes(" — "));
        const body =
          lines.length > 2 && !hasRoutineLine
            ? "- Got through some errands."
            : lines.join("\n");
        blocks.push(`### ${pillar.name}\n${body}`);
        continue;
      }
      const miss = formatLifeAdminMiss(pillar, recap);
      if (!miss) continue;
      blocks.push(`### ${pillar.name}\n${miss}`);
      continue;
    }

    const body = formatPillarTaskLines(recap, pillar, field);
    if (!body) continue;
    blocks.push(`### ${pillar.name}\n${body}`);
  }

  if (!hasLifeAdminPillar(recap)) {
    const tasks = field === "completed" ? recap.general.completed : recap.general.missed;
    const body = collapsePillarTaskLines(
      tasks,
      recap.routines,
      recap.week_monday,
      null,
      field
    ).join("\n");
    if (body) {
      blocks.push(`### General\n${body}`);
    }
  }

  if (blocks.length === 0) {
    return field === "completed" ? "_Nothing recorded._" : "_Nothing major slipped._";
  }
  return blocks.join("\n");
}

function formatWeekSynthesis(recap: WeekRecap): string {
  const pillars = effectivePillars(recap).filter((p) => !isLifeAdminPillarName(p.name));
  const quiet = quietPillars(recap).filter((p) => !isLifeAdminPillarName(p.name));

  const moved = pillars.filter((p) => p.completed.length > 0);
  const slipped = pillars.filter((p) => p.missed.length > 0);
  const mixed = pillars.filter((p) => p.completed.length > 0 && p.missed.length > 0);
  const missOnly = pillars.filter((p) => p.missed.length > 0 && p.completed.length === 0);

  const parts: string[] = [];

  if (moved.length > 0) {
    const lead = moved
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 3)
      .map((p) => p.name);
    parts.push(
      `Momentum showed up most in ${lead.join(", ")}${moved.length > 3 ? ", among others" : ""}.`
    );
  }

  if (mixed.length > 0) {
    parts.push(`${pillarNamesByRank(mixed)} finished some work but still have open items.`);
  } else if (missOnly.length > 0) {
    parts.push(`${pillarNamesByRank(missOnly)} logged misses without completions this week.`);
  } else if (slipped.length > 0 && moved.length > 0) {
    parts.push("A few scheduled items didn't get finished.");
  }

  if (quiet.length > 0) {
    parts.push(`${pillarNamesByRank(quiet)} stayed quiet.`);
  }

  const lifeAdmin = effectivePillars(recap).find((p) => isLifeAdminPillarName(p.name));
  if (lifeAdmin?.completed.length && lifeAdmin.missed.length) {
    parts.push("Life admin made some progress with errands still open.");
  } else if (lifeAdmin?.completed.length) {
    parts.push("Life admin errands got some attention.");
  } else if (lifeAdmin?.missed.length) {
    parts.push("Life admin items are still waiting.");
  }

  const routineNote = formatRoutineSynthesis(recap.routines);
  if (routineNote) {
    parts.push(routineNote);
  }

  if (parts.length === 0) {
    return "A quiet week across the board — a good moment to decide what deserves focus next.";
  }

  return parts.join(" ");
}

function formatWeekReviewBody(recap: WeekRecap): string {
  const range = formatWeekRangeLong(recap.week_monday, recap.week_end);

  return `Here's a breakdown of your week, **${range}**, organized by category:

## Accomplishments
${formatPillarGroupedBucket(recap, "completed")}

---

## Misses
${formatPillarGroupedBucket(recap, "missed")}

---
_${formatWeekSynthesis(recap)}_`;
}

export function formatWeekRecapForPrompt(recap: WeekRecap): string {
  const range = formatWeekRangeLabel(recap.week_monday, recap.week_end);

  return `WEEK REVIEW DATA — ${range} (Mon ${recap.week_monday} through Sun ${recap.week_end})

Present as: accomplishments by pillar → misses by pillar → short week synthesis.
Routines linked to task cards collapse to one line each (e.g. "Yoga — 4/5") instead of repeating the same habit title.
Life admin stays brief (got through some errands / still have items open).

${formatWeekReviewBody(recap)}`;
}

export function formatReflectionKickoff(recap: WeekRecap, pillarName?: string | null): string {
  if (pillarName) {
    return `## ${pillarName} — week in review

${formatWeekReviewBody(recap)}

This journal is focused on **${pillarName}**. Ask about context notes, milestones (current or past), what moved this week, or what to prioritize next.`;
  }

  return `${formatWeekReviewBody(recap)}

Let me know what you'd like to delve into — what mattered, what slipped, or anything the list got wrong.`;
}
