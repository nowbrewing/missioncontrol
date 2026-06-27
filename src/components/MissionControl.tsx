"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MissionAddTask from "./MissionAddTask";
import MissionBrief from "./MissionBrief";
import MissionCheckIn from "./MissionCheckIn";
import MissionLifeAdminStats from "./MissionLifeAdminStats";
import type { LifeAdminStats } from "../lib/life-admin";
import { useOpenChat } from "./open-chat/OpenChatProvider";
import type { MissionReflectionDisplay } from "../lib/mission-reflection-display";
import MissionWeeklyChecklist from "./MissionWeeklyChecklist";
import type { RecurringWeekItem } from "../lib/recurring-events";
import type { RecurringProgress } from "../lib/recurring-week";
import type { BoardItem } from "../lib/mission-layout";
import { todayIsoYyyyMmDd } from "../lib/date";
import { patchTaskInBrief } from "../lib/patch-task-in-brief";
import { sortTodayWithCompletedAtBottom } from "../lib/mission-layout";
import { scheduleTypeFromMode } from "./TaskScheduleSelect";
import type { TaskScheduleMode } from "./TaskScheduleSelect";
import { resolvePillarAbbreviation } from "../lib/pillar-abbreviation";
import type { ComingUpItem, MissionMilestone, MissionTask } from "../lib/mission-prioritize";

type BriefData = {
  today: string;
  calendar_today?: string;
  pillars: {
    id: number;
    name: string;
    abbreviation?: string | null;
    color: string;
    rank: number;
  }[];
  milestones: MissionMilestone[];
  tasks: MissionTask[];
  today_priorities: MissionTask[];
  coming_up_next: ComingUpItem[];
  board_today: BoardItem[];
  board_coming_up: BoardItem[];
  board_done_today?: BoardItem[];
  reflection: MissionReflectionDisplay | null;
  life_admin?: LifeAdminStats | null;
};

export default function MissionControl() {
  const { registerBriefRefresh, syncChatBrief, openCheckInProposedReview } =
    useOpenChat();
  const [planDate, setPlanDate] = useState(() => todayIsoYyyyMmDd());
  const [scrollToBoard, setScrollToBoard] = useState(false);
  const [thisWeekExpanded, setThisWeekExpanded] = useState(false);
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(true);
  const [recurringItems, setRecurringItems] = useState<RecurringWeekItem[]>([]);
  const [recurringWeekMonday, setRecurringWeekMonday] = useState("");
  const [loadingRecurring, setLoadingRecurring] = useState(true);
  const todayAnchorRef = useRef<HTMLDivElement | null>(null);
  const applyBriefRef = useRef<(raw: Record<string, unknown>) => void>(() => {});

  const loadRecurringWeek = useCallback(async () => {
    const res = await fetch("/api/recurring-events/week");
    const data = await res.json();
    if (data.ok) {
      setRecurringItems(data.items ?? []);
      setRecurringWeekMonday(data.week_monday ?? "");
    }
    setLoadingRecurring(false);
  }, []);

  const loadBrief = useCallback(async (focusDate: string) => {
    const res = await fetch(`/api/mission/brief?date=${encodeURIComponent(focusDate)}`);
    const data = await res.json();
    if (data.ok) {
      setBrief({
        today: data.today,
        calendar_today: data.calendar_today,
        pillars: data.pillars,
        milestones: data.milestones,
        tasks: data.tasks,
        today_priorities: data.today_priorities,
        coming_up_next: data.coming_up_next,
        board_today: data.board_today ?? [],
        board_coming_up: data.board_coming_up ?? [],
        board_done_today: data.board_done_today ?? [],
        reflection: data.reflection ?? null,
        life_admin: data.life_admin ?? null,
      });
    }
    setLoadingBrief(false);
  }, []);

  useEffect(() => {
    loadRecurringWeek();
  }, [loadRecurringWeek]);

  useEffect(() => {
    if (!planDate) return;
    loadBrief(planDate);
  }, [planDate, loadBrief]);

  function applyBrief(raw: Record<string, unknown>) {
    const nextBrief = raw as unknown as BriefData;
    setBrief({
      today: nextBrief.today,
      calendar_today: nextBrief.calendar_today,
      pillars: nextBrief.pillars,
      milestones: nextBrief.milestones,
      tasks: nextBrief.tasks,
      today_priorities: nextBrief.today_priorities,
      coming_up_next: nextBrief.coming_up_next,
      board_today: nextBrief.board_today ?? [],
      board_coming_up: nextBrief.board_coming_up ?? [],
      board_done_today: nextBrief.board_done_today ?? [],
      reflection: nextBrief.reflection ?? null,
      life_admin: nextBrief.life_admin ?? null,
    });
  }

  applyBriefRef.current = applyBrief;

  useEffect(() => {
    return registerBriefRefresh((raw) => {
      applyBriefRef.current(raw);
      setScrollToBoard(true);
    });
  }, [registerBriefRefresh]);

  useEffect(() => {
    if (!brief) return;
    syncChatBrief({
      today: brief.today,
      pillars: brief.pillars,
      milestones: brief.milestones,
      tasks: brief.tasks,
    });
  }, [brief, syncChatBrief]);

  function handleCheckInProcessed(data: {
    brief: Record<string, unknown>;
    proposed_tasks?: {
      title: string;
      pillar: string;
      pillar_id: number | null;
      deadline: string | null;
      bucket: "Today" | "Next 7 days" | "Later";
    }[];
  }) {
    applyBrief(data.brief);
    setThisWeekExpanded(false);
    setScrollToBoard(true);
    loadRecurringWeek().catch(() => {
      // Dev HMR can corrupt .next chunks; checklist refresh is non-critical here.
    });

    const taskDrafts = (data.proposed_tasks ?? []).map((task, i) => ({
      localId: `proposed-${i}-${task.title}`,
      title: task.title,
      pillar: task.pillar,
      pillar_id: task.pillar_id,
      deadline: task.deadline,
      bucket: task.bucket,
    }));

    openCheckInProposedReview(taskDrafts);
  }

  useEffect(() => {
    if (!brief || !scrollToBoard) return;
    todayAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setScrollToBoard(false);
  }, [brief, scrollToBoard]);

  async function toggleTask(id: number, completed: boolean) {
    const completed_at = completed ? new Date().toISOString() : null;
    setBrief((prev) => {
      if (!prev) return prev;
      if (!completed) {
        const doneItem = (prev.board_done_today ?? []).find(
          (i) => i.kind === "task" && i.id === id
        );
        if (doneItem) {
          const restored = { ...doneItem, completed_at: null };
          const patched = patchTaskInBrief(prev, id, { completed_at });
          return {
            ...patched,
            board_done_today: (patched.board_done_today ?? []).filter(
              (i) => i.key !== doneItem.key
            ),
            board_today: sortTodayWithCompletedAtBottom([
              ...patched.board_today,
              restored,
            ]),
          };
        }
      }
      const patched = patchTaskInBrief(prev, id, { completed_at });
      return {
        ...patched,
        board_today: sortTodayWithCompletedAtBottom(patched.board_today),
      };
    });
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
    } catch {
      await loadBrief(planDate);
    }
  }

  async function updateTaskDeadline(id: number, deadline: string | null) {
    await updateTaskDeadlineAndBrief(id, deadline);
  }

  function pillarPatch(pillarId: number | null) {
    if (!brief) return {};
    const pillar = pillarId ? brief.pillars.find((p) => p.id === pillarId) : null;
    return {
      pillar_id: pillarId,
      pillar_name: pillar?.name ?? null,
      pillar_abbreviation: pillar
        ? resolvePillarAbbreviation(pillar.name, pillar.abbreviation)
        : null,
      pillar_color: pillar?.color ?? null,
    };
  }

  function milestonePatch(milestoneId: number | null) {
    if (!brief) return { milestone_id: milestoneId, milestone_title: null };
    const milestone = milestoneId
      ? brief.milestones.find((m) => m.id === milestoneId)
      : null;
    return {
      milestone_id: milestoneId,
      milestone_title: milestone?.title ?? null,
    };
  }

  async function updateTaskPillar(id: number, pillarId: number | null) {
    const task = brief?.tasks.find((t) => t.id === id);
    let milestoneId = task?.milestone_id ?? null;
    if (milestoneId && pillarId) {
      const ms = brief?.milestones.find((m) => m.id === milestoneId);
      if (ms && ms.pillar_id !== pillarId) milestoneId = null;
    }
    const patch = {
      ...pillarPatch(pillarId),
      ...milestonePatch(milestoneId),
    };
    setBrief((prev) => (prev ? patchTaskInBrief(prev, id, patch) : prev));
    await patchTask(id, {
      pillar_id: pillarId,
      ...(milestoneId !== task?.milestone_id ? { milestone_id: milestoneId } : {}),
    });
  }

  async function updateTaskMilestone(id: number, milestoneId: number | null) {
    const milestone = milestoneId
      ? brief?.milestones.find((m) => m.id === milestoneId)
      : null;
    const patch = {
      ...milestonePatch(milestoneId),
      ...(milestone?.pillar_id
        ? pillarPatch(milestone.pillar_id)
        : {}),
    };
    setBrief((prev) => (prev ? patchTaskInBrief(prev, id, patch) : prev));
    const body: Record<string, unknown> = { milestone_id: milestoneId };
    if (milestone?.pillar_id) body.pillar_id = milestone.pillar_id;
    await patchTask(id, body);
  }

  async function updateTaskSchedule(id: number, mode: TaskScheduleMode) {
    const schedule_type = scheduleTypeFromMode(mode);
    const patch = {
      schedule_type,
      window_start: null as string | null,
    };
    setBrief((prev) => (prev ? patchTaskInBrief(prev, id, patch) : prev));
    await patchTask(id, { schedule_type, window_start: null });
  }

  async function updateTaskDeadlineAndBrief(id: number, deadline: string | null) {
    setBrief((prev) =>
      prev ? patchTaskInBrief(prev, id, { deadline }) : prev
    );
    await patchTask(id, { deadline });
  }

  async function toggleTaskDateLock(
    id: number,
    locked: boolean,
    deadline: string | null
  ) {
    if (locked && !deadline) return;
    const patch = {
      date_locked: locked,
      ...(locked ? { schedule_type: "fixed" as const } : {}),
    };
    setBrief((prev) => (prev ? patchTaskInBrief(prev, id, patch) : prev));
    await patchTask(id, {
      date_locked: locked,
      ...(locked ? { schedule_type: "fixed" } : {}),
    });
  }

  async function patchTask(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Could not save task");
    }
  }

  async function updateTaskTitle(id: number, title: string) {
    setBrief((prev) => (prev ? patchTaskInBrief(prev, id, { title }) : prev));
    try {
      await patchTask(id, { title });
    } catch {
      await loadBrief(planDate);
      throw new Error("Could not save task title");
    }
  }

  async function updateTaskNote(id: number, note: string | null) {
    setBrief((prev) => (prev ? patchTaskInBrief(prev, id, { note }) : prev));
    try {
      await patchTask(id, { note });
    } catch {
      await loadBrief(planDate);
      throw new Error("Could not save task note");
    }
  }

  async function deleteTask(id: number) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await loadBrief(planDate);
  }

  async function updateRecurringProgress(item: RecurringWeekItem, progress: RecurringProgress) {
    setRecurringItems((prev) =>
      prev.map((row) =>
        row.progress_id === item.progress_id ? { ...row, progress } : row
      )
    );
    await fetch("/api/recurring-events/week", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        progress_id: item.progress_id,
        event_id: item.event_id,
        kind: item.kind,
        target_count: item.target_count,
        week_monday: item.week_monday,
        spawn_task_cards: item.spawn_task_cards,
        tally_enabled: item.tally_enabled,
        progress,
      }),
    });
    await loadBrief(planDate);
  }

  async function reorderRecurringItems(ids: number[]) {
    setRecurringItems((prev) => {
      const byId = new Map(prev.map((item) => [item.event_id, item]));
      return ids
        .map((id) => byId.get(id))
        .filter((item): item is RecurringWeekItem => item != null);
    });
    try {
      const res = await fetch("/api/recurring-events/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not reorder");
      }
    } catch {
      await loadRecurringWeek();
    }
  }

  if (loadingBrief && !brief) {
    return <p className="subtitle">Loading mission control...</p>;
  }

  const calendarToday = brief?.calendar_today ?? brief?.today ?? todayIsoYyyyMmDd();

  return (
    <div className="missionLayout">
      <MissionCheckIn
        planDate={planDate}
        calendarToday={calendarToday}
        onPlanDateChange={setPlanDate}
        onProcessed={handleCheckInProcessed}
      />

      {brief && (
        <div className="missionBoardAndChecklist">
          <div className="missionBoardMain">
            <div ref={todayAnchorRef} />

            <MissionBrief
              today={planDate}
              calendarToday={brief.calendar_today ?? todayIsoYyyyMmDd()}
              boardToday={brief.board_today}
              boardComingUp={brief.board_coming_up}
              boardDoneToday={brief.board_done_today ?? []}
              pillars={brief.pillars}
              milestones={brief.milestones}
              reflection={brief.reflection}
              view="today"
              headerAction={
                <MissionAddTask
                  pillars={brief.pillars}
                  onAdded={() => loadBrief(planDate)}
                />
              }
              onToggleTask={toggleTask}
              onDeadlineChange={updateTaskDeadline}
              onPillarChange={updateTaskPillar}
              onMilestoneChange={updateTaskMilestone}
              onScheduleChange={updateTaskSchedule}
              onTitleChange={updateTaskTitle}
              onNoteChange={updateTaskNote}
              onDeleteTask={deleteTask}
              onDateLockChange={toggleTaskDateLock}
              onLayoutChange={(today, comingUp) =>
                setBrief((prev) =>
                  prev
                    ? { ...prev, board_today: today, board_coming_up: comingUp }
                    : prev
                )
              }
            />

            <div className="missionThisWeekWrap">
              {thisWeekExpanded ? (
                <div className="missionThisWeekPanel">
                  <div className="missionThisWeekHeader">
                    <button
                      type="button"
                      className="outlineButton btnCompact"
                      onClick={() => setThisWeekExpanded(false)}
                    >
                      Hide next 7 days
                    </button>
                  </div>
                  <MissionBrief
                    today={planDate}
                    calendarToday={brief.calendar_today ?? todayIsoYyyyMmDd()}
                    boardToday={brief.board_today}
                    boardComingUp={brief.board_coming_up}
                    pillars={brief.pillars}
                    milestones={brief.milestones}
                    view="week"
                    onToggleTask={toggleTask}
                    onDeadlineChange={updateTaskDeadline}
                    onPillarChange={updateTaskPillar}
                    onMilestoneChange={updateTaskMilestone}
                    onScheduleChange={updateTaskSchedule}
                    onTitleChange={updateTaskTitle}
                    onNoteChange={updateTaskNote}
                    onDeleteTask={deleteTask}
                    onDateLockChange={toggleTaskDateLock}
                    onLayoutChange={(today, comingUp) =>
                      setBrief((prev) =>
                        prev
                          ? {
                              ...prev,
                              board_today: today,
                              board_coming_up: comingUp,
                            }
                          : prev
                      )
                    }
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="outlineButton missionThisWeekToggle"
                  onClick={() => setThisWeekExpanded(true)}
                >
                  Start looking ahead ({brief.board_coming_up.length})
                </button>
              )}
            </div>
          </div>

          <aside className="missionChecklistAside">
            <MissionWeeklyChecklist
              items={recurringItems}
              weekMonday={recurringWeekMonday}
              today={brief.today}
              loading={loadingRecurring}
              onProgressChange={updateRecurringProgress}
              onReorder={reorderRecurringItems}
            />
            <MissionLifeAdminStats stats={brief.life_admin ?? null} />
          </aside>
        </div>
      )}
    </div>
  );
}
