import { isIdeaTask } from "./task-ideas";
import { isYyyyMmDd, todayIsoYyyyMmDd } from "./date";
import { computeLifeAdminStats, enrichTaskPillarDisplay } from "./life-admin";
import { ensureLifeAdminSetup } from "./life-admin-setup";
import { resolvePillarAbbreviation } from "./pillar-abbreviation";
import {
  buildMissionBoard,
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
import { getMissionLayout } from "./mongodb/store/daily-logs";
import { listMilestones } from "./mongodb/store/milestones";
import { listTasks } from "./mongodb/store/tasks";
import { listPillars } from "./mongodb/store/users";
import { parseTaskNoteImages } from "./task-note-images";
import {
  parsePillarNoteFieldDefs,
  parsePillarNoteFieldValues,
} from "./pillar-note-fields";

export async function buildMissionBrief(userId: number, focusDate?: string) {
  await ensureLifeAdminSetup(userId);

  const calendarToday = todayIsoYyyyMmDd();
  const today = focusDate && isYyyyMmDd(focusDate) ? focusDate : calendarToday;

  const [pillars, milestones, tasks, savedLayout] = await Promise.all([
    listPillars(userId),
    listMilestones(userId),
    listTasks(userId),
    getMissionLayout(userId, today),
  ]);

  const pillarById = new Map(pillars.map((p) => [Number(p.id), p]));
  const pillarRankById = new Map(pillars.map((p) => [Number(p.id), Number(p.rank)]));
  const milestoneById = new Map(milestones.map((m) => [Number(m.id), m]));
  const noteFieldsByPillarId = new Map(
    pillars.map((p) => [Number(p.id), parsePillarNoteFieldDefs(p.note_fields)])
  );

  const enrichedTasks: MissionTask[] = tasks
    .filter((t) => !isIdeaTask(t))
    .map((t) => {
    const milestone = t.milestone_id ? milestoneById.get(Number(t.milestone_id)) : null;
    const pillarId = t.pillar_id != null ? Number(t.pillar_id) : null;
    const pillarDisplay = enrichTaskPillarDisplay(
      pillarId,
      pillars.map((p) => ({
        id: Number(p.id),
        name: String(p.name),
        abbreviation: p.abbreviation as string | null | undefined,
        color: String(p.color),
      })),
      resolvePillarAbbreviation
    );
    const noteFields =
      pillarId != null ? (noteFieldsByPillarId.get(pillarId) ?? []) : [];
    return {
      id: Number(t.id),
      title: String(t.title),
      description: t.description ? String(t.description) : null,
      note: t.note ? String(t.note) : null,
      note_images: parseTaskNoteImages(t.note_images),
      note_field_values: parsePillarNoteFieldValues(t.note_field_values, noteFields),
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
      pillar_name: pillarDisplay.pillar_name,
      pillar_abbreviation: pillarDisplay.pillar_abbreviation,
      pillar_color: pillarDisplay.pillar_color,
      milestone_title: milestone ? String(milestone.title) : null,
      is_new: Number(t.is_new) === 1,
      date_locked: Number(t.date_locked) === 1,
    };
  });

  const enrichedMilestones: MissionMilestone[] = milestones.map((m) => {
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

  const board = buildMissionBoard(
    enrichedTasks,
    sortedTodayTasks,
    comingUpNext,
    enrichedMilestones,
    savedLayout,
    today,
    pillarRankById
  );

  const reflection = buildReflectionDisplay(
    savedLayout?.reflection,
    enrichedTasks,
    enrichedMilestones
  );

  const life_admin = computeLifeAdminStats({
    allTasks: enrichedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      deadline: t.deadline,
      pillar_id: t.pillar_id,
      completed_at: t.completed_at,
      created_at: t.created_at,
    })),
    pillars: pillars.map((p) => ({
      id: Number(p.id),
      name: String(p.name),
    })),
    planDate: today,
    todayTaskIds: board.today
      .filter((item) => item.kind === "task")
      .map((item) => item.id),
  });

  return {
    today,
    calendar_today: calendarToday,
    pillars,
    milestones: enrichedMilestones,
    tasks: enrichedTasks,
    today_priorities: sortedTodayTasks.slice(0, 8),
    coming_up_next: comingUpNext,
    board_today: board.today,
    board_coming_up: board.coming_up,
    board_done_today: board.done_today,
    reflection,
    life_admin,
  };
}
