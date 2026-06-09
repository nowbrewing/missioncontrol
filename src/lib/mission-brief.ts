import type { Client } from "@libsql/client";
import { ensureLifeSchema } from "../db/life";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "./date";
import { resolvePillarAbbreviation } from "./pillar-abbreviation";
import {
  buildMissionBoard,
  parseMissionLayout,
  type BoardItem,
} from "./mission-layout";
import { buildReflectionDisplay } from "./mission-reflection-display";
import {
  getComingUpNext,
  sortTasksForToday,
  type ComingUpItem,
  type MissionMilestone,
  type MissionTask,
} from "./mission-prioritize";

export async function buildMissionBrief(
  turso: Client,
  userId: number,
  focusDate?: string
) {
  await ensureLifeSchema(turso);
  const calendarToday = todayIsoYyyyMmDd();
  const today =
    focusDate && isYyyyMmDd(focusDate) ? focusDate : calendarToday;

  const [pillars, milestones, tasks, dailyLog] = await Promise.all([
    turso.execute({
      sql: `SELECT id, name, abbreviation, color, rank FROM pillars WHERE user_id = ? ORDER BY rank ASC, id ASC;`,
      args: [userId],
    }),
    turso.execute({
      sql: `SELECT id, title, target_date, completed_at, pillar_id FROM milestones
            WHERE user_id = ? ORDER BY rank ASC, id ASC;`,
      args: [userId],
    }),
    turso.execute({
      sql: `SELECT id, title, description, deadline, completed_at, rank, pillar_id, milestone_id, schedule_type, window_start, recurring_event_id, recurring_slot, created_at
            FROM tasks WHERE user_id = ?
            ORDER BY completed_at IS NOT NULL, rank ASC, id ASC;`,
      args: [userId],
    }),
    turso.execute({
      sql: `SELECT mission_layout FROM daily_logs WHERE user_id = ? AND log_date = ? LIMIT 1;`,
      args: [userId, today],
    }),
  ]);

  const pillarById = new Map(
    (pillars.rows as Record<string, unknown>[]).map((p) => [Number(p.id), p])
  );
  const pillarRankById = new Map(
    (pillars.rows as Record<string, unknown>[]).map((p) => [Number(p.id), Number(p.rank)])
  );
  const milestoneById = new Map(
    (milestones.rows as Record<string, unknown>[]).map((m) => [Number(m.id), m])
  );

  const enrichedTasks: MissionTask[] = (tasks.rows as Record<string, unknown>[]).map((t) => {
    const pillar = t.pillar_id ? pillarById.get(Number(t.pillar_id)) : null;
    const milestone = t.milestone_id ? milestoneById.get(Number(t.milestone_id)) : null;
    return {
      id: Number(t.id),
      title: String(t.title),
      description: t.description ? String(t.description) : null,
      deadline: t.deadline ? String(t.deadline) : null,
      schedule_type: t.schedule_type ? String(t.schedule_type) : "flexible",
      window_start: t.window_start ? String(t.window_start) : null,
      recurring_event_id:
        t.recurring_event_id != null ? Number(t.recurring_event_id) : null,
      recurring_slot: t.recurring_slot ? String(t.recurring_slot) : null,
      completed_at: t.completed_at ? String(t.completed_at) : null,
      rank: Number(t.rank),
      pillar_id: t.pillar_id != null ? Number(t.pillar_id) : null,
      milestone_id: t.milestone_id != null ? Number(t.milestone_id) : null,
      created_at: String(t.created_at),
      pillar_name: pillar ? String(pillar.name) : null,
      pillar_abbreviation: pillar
        ? resolvePillarAbbreviation(
            String(pillar.name),
            pillar.abbreviation as string | null | undefined
          )
        : null,
      pillar_color: pillar ? String(pillar.color) : null,
      milestone_title: milestone ? String(milestone.title) : null,
    };
  });

  const enrichedMilestones: MissionMilestone[] = (
    milestones.rows as Record<string, unknown>[]
  ).map((m) => {
    const pillar = m.pillar_id ? pillarById.get(Number(m.pillar_id)) : null;
    return {
      id: Number(m.id),
      title: String(m.title),
      target_date: m.target_date ? String(m.target_date) : null,
      completed_at: m.completed_at ? String(m.completed_at) : null,
      pillar_id: m.pillar_id != null ? Number(m.pillar_id) : null,
      pillar_name: pillar ? String(pillar.name) : null,
      pillar_abbreviation: pillar
        ? resolvePillarAbbreviation(
            String(pillar.name),
            pillar.abbreviation as string | null | undefined
          )
        : null,
      pillar_color: pillar ? String(pillar.color) : null,
    };
  });

  const sortedTodayTasks = sortTasksForToday(enrichedTasks, today, pillarRankById);
  const comingUpNext: ComingUpItem[] = getComingUpNext(
    enrichedTasks,
    enrichedMilestones,
    today
  );

  const savedLayout = parseMissionLayout(
    (dailyLog.rows[0] as Record<string, unknown> | undefined)?.mission_layout as string | undefined
  );
  const board = buildMissionBoard(
    enrichedTasks,
    sortedTodayTasks,
    comingUpNext,
    enrichedMilestones,
    savedLayout,
    today
  );

  const reflection = buildReflectionDisplay(
    savedLayout?.reflection,
    enrichedTasks,
    enrichedMilestones
  );

  return {
    today,
    calendar_today: calendarToday,
    pillars: pillars.rows,
    milestones: enrichedMilestones,
    tasks: enrichedTasks,
    today_priorities: sortedTodayTasks.slice(0, 8),
    coming_up_next: comingUpNext,
    board_today: board.today,
    board_coming_up: board.coming_up,
    reflection,
  };
}
