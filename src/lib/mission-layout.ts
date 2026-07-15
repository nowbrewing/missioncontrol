import { isDaySpecificScheduled, shouldSurfaceOverdueOnToday, taskBelongsInTodayPriorities } from "./task-schedule";
import { isInNext7Days } from "./mission-buckets";
import type { ComingUpItem, MissionMilestone, MissionTask } from "./mission-prioritize";
import type { TaskNoteImage } from "./task-note-images";
import type { PillarNoteFieldValues } from "./pillar-note-fields";

export type MissionLayoutRef = {
  kind: "task" | "milestone";
  id: number;
  /** Explicitly placed on this day's priorities (drag, promote, focus today). */
  pinned?: boolean;
};

export type MissionReflectionBuckets = {
  today: MissionLayoutRef[];
  tomorrow: MissionLayoutRef[];
  this_week: MissionLayoutRef[];
  later: MissionLayoutRef[];
};

export type MissionReflectionSnapshot = {
  reflection: string;
  kickoff?: string;
  rest_of_day?: string;
  flags: string[];
  buckets: MissionReflectionBuckets;
  generated_at: string;
};

export type MissionLayout = {
  today: MissionLayoutRef[];
  coming_up: MissionLayoutRef[];
  /** Tasks/milestones assigned to Later — excluded from auto-merge onto the board. */
  later?: MissionLayoutRef[];
  /** When true, preserve today column order from layout; otherwise sort by due date + pillar rank. */
  today_user_ordered?: boolean;
  reflection?: MissionReflectionSnapshot;
};

export type BoardItem = {
  key: string;
  kind: "task" | "milestone";
  id: number;
  title: string;
  note?: string | null;
  note_images?: TaskNoteImage[];
  note_field_values?: PillarNoteFieldValues;
  date: string | null;
  schedule_type?: string | null;
  window_start?: string | null;
  pillar_id?: number | null;
  pillar_name?: string | null;
  pillar_abbreviation?: string | null;
  pillar_color?: string | null;
  milestone_id?: number | null;
  milestone_title?: string | null;
  completed_at?: string | null;
  created_at?: string;
  is_new?: boolean;
  date_locked?: boolean;
};

export function boardItemKey(kind: "task" | "milestone", id: number) {
  return `${kind}-${id}`;
}

export function completedOnDate(completedAt: string, dateIso: string) {
  return completedAt.slice(0, 10) === dateIso;
}

function collectDoneTodayItems(
  allTasks: MissionTask[],
  layoutToday: MissionLayoutRef[],
  todayTaskCandidates: MissionTask[],
  todayIso: string
): BoardItem[] {
  const eligibleIds = new Set<number>();
  for (const ref of layoutToday) {
    if (ref.kind === "task") eligibleIds.add(ref.id);
  }
  for (const task of todayTaskCandidates) {
    eligibleIds.add(task.id);
  }

  const items: BoardItem[] = [];
  const seen = new Set<string>();
  for (const task of allTasks) {
    if (!eligibleIds.has(task.id)) continue;
    if (!task.completed_at || !completedOnDate(task.completed_at, todayIso)) {
      continue;
    }
    const key = boardItemKey("task", task.id);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(taskToBoardItem(task));
  }
  return items;
}

export function sortComingUpByDate(items: BoardItem[]): BoardItem[] {
  return [...items].sort((a, b) => {
    if (!a.date && !b.date) return a.title.localeCompare(b.title);
    if (!a.date) return 1;
    if (!b.date) return -1;
    const byDate = a.date.localeCompare(b.date);
    return byDate !== 0 ? byDate : a.title.localeCompare(b.title);
  });
}

/** Default Today column order: earliest due first, then higher-priority pillar (lower rank). */
export function sortTodayBoardItems(
  items: BoardItem[],
  pillarRankById: Map<number, number>
): BoardItem[] {
  return [...items].sort((a, b) => {
    const dateA = a.date ?? "9999-12-31";
    const dateB = b.date ?? "9999-12-31";
    const byDate = dateA.localeCompare(dateB);
    if (byDate !== 0) return byDate;

    const rankA =
      a.pillar_id != null ? pillarRankById.get(a.pillar_id) ?? 999 : 999;
    const rankB =
      b.pillar_id != null ? pillarRankById.get(b.pillar_id) ?? 999 : 999;
    if (rankA !== rankB) return rankA - rankB;

    return a.title.localeCompare(b.title);
  });
}

/** Open tasks first (stable order), completed tasks last — for live Today list UX. */
export function sortTodayWithCompletedAtBottom(items: BoardItem[]): BoardItem[] {
  const open: BoardItem[] = [];
  const done: BoardItem[] = [];
  for (const item of items) {
    if (item.kind === "task" && item.completed_at) {
      done.push(item);
    } else {
      open.push(item);
    }
  }
  return [...open, ...done];
}

export function parseMissionLayout(raw: string | null | undefined): MissionLayout | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MissionLayout;
    if (!Array.isArray(parsed.today) || !Array.isArray(parsed.coming_up)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function taskToBoardItem(task: MissionTask): BoardItem {
  return {
    key: boardItemKey("task", task.id),
    kind: "task",
    id: task.id,
    title: task.title,
    note: task.note,
    note_images: task.note_images,
    note_field_values: task.note_field_values,
    date: task.deadline,
    schedule_type: task.schedule_type,
    window_start: task.window_start,
    pillar_id: task.pillar_id,
    pillar_name: task.pillar_name,
    pillar_abbreviation: task.pillar_abbreviation,
    pillar_color: task.pillar_color,
    milestone_id: task.milestone_id,
    milestone_title: task.milestone_title,
    completed_at: task.completed_at,
    created_at: task.created_at,
    is_new: task.is_new,
    date_locked: task.date_locked,
  };
}

function milestoneToBoardItem(milestone: MissionMilestone): BoardItem {
  return {
    key: boardItemKey("milestone", milestone.id),
    kind: "milestone",
    id: milestone.id,
    title: milestone.title,
    date: milestone.target_date,
    pillar_name: milestone.pillar_name,
    pillar_abbreviation: milestone.pillar_abbreviation,
    pillar_color: milestone.pillar_color,
    completed_at: milestone.completed_at,
  };
}

function comingUpToBoardItem(item: ComingUpItem): BoardItem {
  return {
    key: boardItemKey(item.kind, item.id),
    kind: item.kind,
    id: item.id,
    title: item.title,
    date: item.date,
    pillar_name: item.pillar_name,
    pillar_abbreviation: item.pillar_abbreviation,
    pillar_color: item.pillar_color,
    milestone_title: item.kind === "task" ? item.milestone_title : undefined,
  };
}

function resolveRefs(
  refs: MissionLayoutRef[],
  taskById: Map<number, MissionTask>,
  milestoneById: Map<number, MissionMilestone>,
  comingUpByKey: Map<string, BoardItem>
): BoardItem[] {
  const items: BoardItem[] = [];
  for (const ref of refs) {
    if (ref.kind === "task") {
      const task = taskById.get(ref.id);
      if (task && !task.completed_at) items.push(taskToBoardItem(task));
    } else {
      const milestone = milestoneById.get(ref.id);
      if (milestone && !milestone.completed_at) items.push(milestoneToBoardItem(milestone));
      else {
        const fallback = comingUpByKey.get(boardItemKey(ref.kind, ref.id));
        if (fallback) items.push(fallback);
      }
    }
  }
  return items;
}

export function buildMissionBoard(
  allTasks: MissionTask[],
  todayTasks: MissionTask[],
  comingUpNext: ComingUpItem[],
  milestones: MissionMilestone[],
  savedLayout: MissionLayout | null,
  todayIso: string,
  pillarRankById: Map<number, number> = new Map()
) {
  const taskById = new Map(allTasks.map((t) => [t.id, t]));
  const milestoneById = new Map(milestones.map((m) => [m.id, m]));
  const comingUpByKey = new Map(comingUpNext.map((i) => [boardItemKey(i.kind, i.id), comingUpToBoardItem(i)]));

  const defaultToday = todayTasks
    .filter(
      (t) =>
        !t.completed_at && taskBelongsInTodayPriorities(t, todayIso)
    )
    .slice(0, 8)
    .map(taskToBoardItem);

  const futureTasks = allTasks
    .filter(
      (t) =>
        !t.completed_at &&
        t.deadline &&
        isInNext7Days(t.deadline, todayIso) &&
        !taskBelongsInTodayPriorities(t, todayIso)
    )
    .map((t) => comingUpToBoardItem({
      kind: "task",
      id: t.id,
      title: t.title,
      date: t.deadline!,
      pillar_name: t.pillar_name,
      pillar_abbreviation: t.pillar_abbreviation,
      pillar_color: t.pillar_color,
      milestone_title: t.milestone_title,
    }));

  const defaultComingUp = sortComingUpByDate(
    [...comingUpNext.map(comingUpToBoardItem), ...futureTasks].filter(
      (item, idx, arr) =>
        arr.findIndex((x) => x.key === item.key) === idx &&
        !defaultToday.some((t) => t.key === item.key)
    )
  );

  if (!savedLayout) {
    const today = sortTodayBoardItems(defaultToday, pillarRankById);
    const done_today = collectDoneTodayItems(
      allTasks,
      [],
      todayTasks.filter((t) => taskBelongsInTodayPriorities(t, todayIso)),
      todayIso
    );
    return {
      today,
      coming_up: defaultComingUp,
      done_today,
    };
  }

  const userOrderedToday = savedLayout.today_user_ordered === true;

  const pinnedByKey = new Map(
    savedLayout.today.map((ref) => [boardItemKey(ref.kind, ref.id), !!ref.pinned])
  );

  const resolvedToday = resolveRefs(savedLayout.today, taskById, milestoneById, comingUpByKey);
  const coming_up = resolveRefs(savedLayout.coming_up, taskById, milestoneById, comingUpByKey);

  const today: BoardItem[] = [];
  const displaced: BoardItem[] = [];

  for (const item of resolvedToday) {
    if (item.kind !== "task") {
      today.push(item);
      continue;
    }
    const task = taskById.get(item.id);
    if (!task || task.completed_at) continue;

    const pinned = pinnedByKey.get(item.key);
    const belongs = taskBelongsInTodayPriorities(task, todayIso);
    const dateLocked = Number(task.date_locked) === 1;
    // Day-specific runs/recurring cards follow their deadline, not stale layout pins.
    // Date-locked tasks only appear on their deadline day.
    if (belongs || (pinned && !isDaySpecificScheduled(task) && !dateLocked)) {
      today.push(item);
    } else {
      displaced.push(item);
    }
  }

  const laterKeys = new Set(
    (savedLayout.later ?? savedLayout.reflection?.buckets.later ?? []).map((r) =>
      boardItemKey(r.kind, r.id)
    )
  );

  const todayKeys = new Set(today.map((i) => i.key));
  const comingKeys = new Set(coming_up.map((i) => i.key));

  for (const item of displaced) {
    if (laterKeys.has(item.key)) continue;
    if (!todayKeys.has(item.key) && !comingKeys.has(item.key)) {
      coming_up.push(item);
      comingKeys.add(item.key);
    }
  }

  for (const item of defaultToday) {
    if (laterKeys.has(item.key)) continue;
    if (!todayKeys.has(item.key) && !comingKeys.has(item.key)) {
      today.push(item);
      todayKeys.add(item.key);
    }
  }
  for (const item of defaultComingUp) {
    if (laterKeys.has(item.key)) continue;
    if (!todayKeys.has(item.key) && !comingKeys.has(item.key)) {
      coming_up.push(item);
      comingKeys.add(item.key);
    }
  }

  const overduePromoted: BoardItem[] = [];
  const comingUpFiltered = coming_up.filter((item) => {
    if (item.kind !== "task" || laterKeys.has(item.key)) return true;
    const task = taskById.get(item.id);
    if (!task || !shouldSurfaceOverdueOnToday(task, todayIso)) return true;
    if (!todayKeys.has(item.key)) {
      overduePromoted.push(item);
      todayKeys.add(item.key);
    }
    return false;
  });
  today.push(...overduePromoted);

  if (!userOrderedToday) {
    today.splice(0, today.length, ...sortTodayBoardItems(today, pillarRankById));
  }

  const done_today = collectDoneTodayItems(
    allTasks,
    savedLayout.today,
    todayTasks,
    todayIso
  );

  return { today, coming_up: sortComingUpByDate(comingUpFiltered), done_today };
}

export function boardToLayout(
  today: BoardItem[],
  coming_up: BoardItem[],
  options?: { today_user_ordered?: boolean }
): MissionLayout {
  return {
    today: today.map((i) => ({ kind: i.kind, id: i.id, pinned: true })),
    coming_up: coming_up.map((i) => ({ kind: i.kind, id: i.id })),
    ...(options?.today_user_ordered ? { today_user_ordered: true } : {}),
  };
}
