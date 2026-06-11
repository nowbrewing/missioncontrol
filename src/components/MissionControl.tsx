"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MissionAddTask from "./MissionAddTask";
import MissionBrief from "./MissionBrief";
import MissionCheckIn from "./MissionCheckIn";
import MissionLifeAdminStats from "./MissionLifeAdminStats";
import type { LifeAdminStats } from "../lib/life-admin";
import ProposedTasksReviewModal, {
  type ProposedTaskDraft,
} from "./ProposedTasksReviewModal";
import type { MissionReflectionDisplay } from "../lib/mission-reflection-display";
import MissionWeeklyChecklist from "./MissionWeeklyChecklist";
import type { RecurringWeekItem } from "../lib/recurring-events";
import type { RecurringProgress } from "../lib/recurring-week";
import type { BoardItem } from "../lib/mission-layout";
import { todayIsoYyyyMmDd } from "../lib/date";
import { patchTaskInBrief } from "../lib/patch-task-in-brief";
import { scheduleTypeFromMode } from "./TaskScheduleSelect";
import type { TaskScheduleMode } from "./TaskScheduleSelect";
import { resolvePillarAbbreviation } from "../lib/pillar-abbreviation";
import type { ComingUpItem, MissionMilestone, MissionTask } from "../lib/mission-prioritize";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

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
  reflection: MissionReflectionDisplay | null;
  life_admin?: LifeAdminStats | null;
};

export default function MissionControl() {
  const [planDate, setPlanDate] = useState(() => todayIsoYyyyMmDd());
  const [scrollToBoard, setScrollToBoard] = useState(false);
  const [thisWeekExpanded, setThisWeekExpanded] = useState(false);
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [recurringItems, setRecurringItems] = useState<RecurringWeekItem[]>([]);
  const [recurringWeekMonday, setRecurringWeekMonday] = useState("");
  const [loadingRecurring, setLoadingRecurring] = useState(true);
  const [proposedTasks, setProposedTasks] = useState<ProposedTaskDraft[]>([]);
  const [proposedReviewOpen, setProposedReviewOpen] = useState(false);
  const [savingProposed, setSavingProposed] = useState(false);
  const todayAnchorRef = useRef<HTMLDivElement | null>(null);

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
      reflection: nextBrief.reflection ?? null,
      life_admin: nextBrief.life_admin ?? null,
    });
  }

  function openProposedTaskReview(drafts: ProposedTaskDraft[]) {
    if (drafts.length === 0) return;
    setProposedTasks(drafts);
    setProposedReviewOpen(true);
  }

  function handleCheckInProcessed(data: {
    brief: Record<string, unknown>;
    proposed_tasks?: {
      title: string;
      pillar: string;
      pillar_id: number | null;
      deadline: string | null;
      bucket: "Today" | "This Week" | "Later";
    }[];
  }) {
    applyBrief(data.brief);
    setThisWeekExpanded(false);
    setScrollToBoard(true);
    loadRecurringWeek().catch(() => {
      // Dev HMR can corrupt .next chunks; checklist refresh is non-critical here.
    });

    const taskDrafts: ProposedTaskDraft[] = (data.proposed_tasks ?? []).map(
      (task, i) => ({
        localId: `proposed-${i}-${task.title}`,
        title: task.title,
        pillar: task.pillar,
        pillar_id: task.pillar_id,
        deadline: task.deadline,
        bucket: task.bucket,
      })
    );

    openProposedTaskReview(taskDrafts);
  }

  async function confirmProposedTasks(tasks: ProposedTaskDraft[]) {
    if (tasks.length === 0) {
      setProposedReviewOpen(false);
      setProposedTasks([]);
      return;
    }

    setSavingProposed(true);
    try {
      const res = await fetch("/api/mission/proposed-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_date: planDate,
          tasks: tasks.map((t) => ({
            title: t.title.trim(),
            pillar_id: t.pillar_id,
            deadline: t.deadline,
            bucket: t.bucket,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save tasks");
      }
      if (data.brief) applyBrief(data.brief);
      setProposedReviewOpen(false);
      setProposedTasks([]);
      setScrollToBoard(true);
    } finally {
      setSavingProposed(false);
    }
  }

  function dismissProposedReview() {
    if (savingProposed) return;
    setProposedReviewOpen(false);
    setProposedTasks([]);
  }

  useEffect(() => {
    if (!brief || !scrollToBoard) return;
    todayAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setScrollToBoard(false);
  }, [brief, scrollToBoard]);

  async function toggleTask(id: number, completed: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    await loadBrief(planDate);
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

  async function onChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatBusy) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    const nextHistory = [...chatMessages, userMessage];
    setChatMessages(nextHistory);
    setChatInput("");
    setChatBusy(true);
    setChatError(null);

    try {
      const res = await fetch("/api/mission/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          plan_date: planDate,
          history: chatMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Chat failed");
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: String(data.reply),
        },
      ]);
      await loadBrief(planDate);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setChatBusy(false);
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

      {proposedReviewOpen && brief && (
        <ProposedTasksReviewModal
          key={proposedTasks.map((t) => t.localId).join("|")}
          tasks={proposedTasks}
          pillars={brief.pillars}
          planDate={planDate}
          saving={savingProposed}
          onConfirm={confirmProposedTasks}
          onDismiss={dismissProposedReview}
        />
      )}

      {brief && (
        <div className="missionBoardAndChecklist">
          <div className="missionBoardMain">
            <div ref={todayAnchorRef} />

            <MissionBrief
              today={planDate}
              calendarToday={brief.calendar_today ?? todayIsoYyyyMmDd()}
              boardToday={brief.board_today}
              boardComingUp={brief.board_coming_up}
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
                      Hide this week
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
            />
            <MissionLifeAdminStats stats={brief.life_admin ?? null} />
          </aside>
        </div>
      )}

      <section className="section missionChat">
        <button
          type="button"
          className="missionChatToggle outlineButton"
          onClick={() => setShowChat((v) => !v)}
        >
          {showChat ? "Hide follow-up chat" : "Confirm or refine with Life Agent"}
        </button>

        {showChat && (
          <>
            <p className="sectionHint">
              Optional: confirm the day plan or ask the Life Agent to adjust priorities.
            </p>
            <div className="chatMessages" aria-live="polite">
              {chatMessages.length === 0 && (
                <div className="chatEmpty card">
                  e.g. &quot;Looks good — save it&quot; or &quot;Move the dentist task to
                  later this week&quot;
                </div>
              )}
              {chatMessages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={message.id}
                    className={`chatBubble ${isUser ? "chatBubbleUser" : "chatBubbleAssistant"}`}
                  >
                    <p className="chatTextPart">{message.content}</p>
                  </div>
                );
              })}
            </div>
            {chatError && (
              <div className="chatErrorBox">
                <strong>Assistant error</strong>
                <p className="chatError">{chatError}</p>
              </div>
            )}
            <form className="chatForm" onSubmit={onChatSubmit}>
              <textarea
                className="chatInput"
                rows={2}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Confirm the plan or ask for changes..."
                disabled={chatBusy}
              />
              <button
                className="chatSendBtn"
                type="submit"
                disabled={chatBusy || !chatInput.trim()}
              >
                {chatBusy ? "..." : "Send"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
