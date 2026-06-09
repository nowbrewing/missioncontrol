import { isDaySpecificScheduled, taskBelongsInTodayPriorities } from "./task-schedule";
import type { ComingUpItem, MissionMilestone, MissionTask } from "./mission-prioritize";

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
  flags: string[];
  buckets: MissionReflectionBuckets;
  generated_at: string;
};

export type MissionLayout = {
  today: MissionLayoutRef[];
  coming_up: MissionLayoutRef[];
  /** Tasks/milestones assigned to Later — excluded from auto-merge onto the board. */
  later?: MissionLayoutRef[];
  reflection?: MissionReflectionSnapshot;
};

export type BoardItem = {
  key: string;
  kind: "task" | "milestone";
  id: number;
  title: string;
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
};

export function boardItemKey(kind: "task" | "milestone", id: number) {
  return `${kind}-${id}`;
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
  todayIso: string
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
    return { today: defaultToday, coming_up: defaultComingUp };
  }

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
    // Day-specific runs/recurring cards follow their deadline, not stale layout pins.
    if (belongs || (pinned && !isDaySpecificScheduled(task))) {
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

  return { today, coming_up: sortComingUpByDate(coming_up) };
}

export function boardToLayout(today: BoardItem[], coming_up: BoardItem[]): MissionLayout {
  return {
    today: today.map((i) => ({ kind: i.kind, id: i.id, pinned: true })),
    coming_up: coming_up.map((i) => ({ kind: i.kind, id: i.id })),
  };
}
