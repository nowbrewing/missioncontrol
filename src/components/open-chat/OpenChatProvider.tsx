"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import ProposedTasksReviewModal, {
  type ProposedTaskDraft,
} from "../ProposedTasksReviewModal";
import TaskEditsReviewModal, {
  type TaskEditDraft,
} from "../TaskEditsReviewModal";
import ChatTaskNotesReviewModal, {
  type NewTaskNoteDraft,
  type TaskNoteUpdateDraft,
} from "../ChatTaskNotesReviewModal";
import CorrectionReviewModal from "../correction/CorrectionReviewModal";
import { todayIsoYyyyMmDd } from "../../lib/date";
import {
  applyProposedCorrections,
  loadCorrectionKickoff,
  proposeCorrectionsFromMessages,
} from "../../lib/chat-correction-skill";
import { notifyDailyLogChanged } from "../../lib/daily-log-events";
import { appendTaskNote } from "../../lib/task-notes";
import { parseChatSlashCommand, type ChatMode, type ForcedSkillId } from "../../lib/chat-mode";
import type { ProposedCorrection } from "../../lib/adk/propose-corrections";
import type { ChatBriefContext, ChatMessage, OpenChatContextValue } from "./types";

const OpenChatContext = createContext<OpenChatContextValue | null>(null);

type ExtractedTaskNotesApiData = {
  task_note_updates?: {
    task_id: number;
    task_title: string;
    existing_note: string | null;
    note: string;
  }[];
  new_tasks?: {
    title: string;
    pillar: string;
    pillar_id: number | null;
    note: string;
    deadline: string | null;
    bucket: "Today" | "Next 7 days" | "Later";
  }[];
};

function mapExtractedTaskNotes(data: ExtractedTaskNotesApiData, idPrefix: string) {
  const noteUpdates: TaskNoteUpdateDraft[] = (data.task_note_updates ?? []).map(
    (row, i) => ({
      localId: `${idPrefix}-note-update-${row.task_id}-${i}`,
      task_id: row.task_id,
      task_title: row.task_title,
      existing_note: row.existing_note,
      note: row.note,
    })
  );

  const newTasks: NewTaskNoteDraft[] = (data.new_tasks ?? []).map((row, i) => ({
    localId: `${idPrefix}-new-task-note-${i}-${row.title}`,
    title: row.title,
    pillar: row.pillar,
    pillar_id: row.pillar_id,
    note: row.note,
    deadline: row.deadline,
    bucket: row.bucket,
  }));

  return { noteUpdates, newTasks };
}

export function useOpenChat() {
  const ctx = useContext(OpenChatContext);
  if (!ctx) {
    throw new Error("useOpenChat must be used within OpenChatProvider");
  }
  return ctx;
}

export function useOptionalOpenChat() {
  return useContext(OpenChatContext);
}

export function OpenChatProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [planDate] = useState(() => todayIsoYyyyMmDd());
  const [chatBrief, setChatBrief] = useState<ChatBriefContext | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [floatingOpen, setFloatingOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMode, setChatMode] = useState<ChatMode>("copilot");
  const [chatBusy, setChatBusy] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [summarizingSession, setSummarizingSession] = useState(false);
  const [sessionSaveNotice, setSessionSaveNotice] = useState<string | null>(null);
  const [proposedTasks, setProposedTasks] = useState<ProposedTaskDraft[]>([]);
  const [proposedReviewOpen, setProposedReviewOpen] = useState(false);
  const [proposedReviewSource, setProposedReviewSource] = useState<
    "check-in" | "chat"
  >("chat");
  const [savingProposed, setSavingProposed] = useState(false);
  const [proposedSaveError, setProposedSaveError] = useState<string | null>(null);
  const [taskEdits, setTaskEdits] = useState<TaskEditDraft[]>([]);
  const [taskEditsOpen, setTaskEditsOpen] = useState(false);
  const [pendingTaskEdits, setPendingTaskEdits] = useState<TaskEditDraft[]>([]);
  const [savingTaskEdits, setSavingTaskEdits] = useState(false);
  const [taskEditsSaveError, setTaskEditsSaveError] = useState<string | null>(null);
  const [taskNotesReviewOpen, setTaskNotesReviewOpen] = useState(false);
  const [taskNoteUpdates, setTaskNoteUpdates] = useState<TaskNoteUpdateDraft[]>([]);
  const [newTasksWithNotes, setNewTasksWithNotes] = useState<NewTaskNoteDraft[]>([]);
  const [savingTaskNotes, setSavingTaskNotes] = useState(false);
  const [taskNotesSaveError, setTaskNotesSaveError] = useState<string | null>(null);
  const [correctionWeekLabel, setCorrectionWeekLabel] = useState<string | null>(null);
  const [correctionProposing, setCorrectionProposing] = useState(false);
  const [correctionReviewOpen, setCorrectionReviewOpen] = useState(false);
  const [correctionProposals, setCorrectionProposals] = useState<ProposedCorrection[]>([]);
  const [savingCorrections, setSavingCorrections] = useState(false);
  const [correctionSaveError, setCorrectionSaveError] = useState<string | null>(null);
  const pendingClearAfterRef = useRef(false);
  const taskNotesReviewOpenRef = useRef(false);
  const router = useRouter();

  const chatMessagesRef = useRef(chatMessages);
  const chatModeRef = useRef(chatMode);
  const summarizedCountRef = useRef(0);
  const chatBusyRef = useRef(chatBusy);
  const handoffBusyRef = useRef(handoffBusy);
  const generalSessionStartRef = useRef<number | null>(null);
  const correctionSessionStartRef = useRef<number | null>(null);
  const copilotHandoffSummaryRef = useRef<string | null>(null);
  const planDateRef = useRef(planDate);
  const finalizeInFlightRef = useRef(false);
  const briefRefreshHandlersRef = useRef(
    new Set<(brief: Record<string, unknown>) => void>()
  );

  chatMessagesRef.current = chatMessages;
  chatModeRef.current = chatMode;
  chatBusyRef.current = chatBusy;
  handoffBusyRef.current = handoffBusy;
  planDateRef.current = planDate;
  taskNotesReviewOpenRef.current = taskNotesReviewOpen;

  const loadChatBrief = useCallback(async (focusDate: string) => {
    const res = await fetch(`/api/mission/brief?date=${encodeURIComponent(focusDate)}`);
    const data = await res.json();
    if (!data.ok) return null;
    return {
      today: data.today,
      pillars: data.pillars,
      milestones: data.milestones,
      tasks: data.tasks,
    } satisfies ChatBriefContext;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void loadChatBrief(planDate).then((brief) => {
      if (brief) setChatBrief(brief);
    });
  }, [enabled, loadChatBrief, planDate]);

  const registerBriefRefresh = useCallback(
    (fn: (brief: Record<string, unknown>) => void) => {
      briefRefreshHandlersRef.current.add(fn);
      return () => {
        briefRefreshHandlersRef.current.delete(fn);
      };
    },
    []
  );

  const notifyBriefRefresh = useCallback((brief: Record<string, unknown>) => {
    for (const fn of briefRefreshHandlersRef.current) {
      fn(brief);
    }
  }, []);

  const syncChatBrief = useCallback((brief: ChatBriefContext) => {
    setChatBrief(brief);
  }, []);

  const applyChatBrief = useCallback((raw: Record<string, unknown>) => {
    setChatBrief({
      today: String(raw.today ?? planDateRef.current),
      pillars: raw.pillars as ChatBriefContext["pillars"],
      milestones: raw.milestones as ChatBriefContext["milestones"],
      tasks: raw.tasks as ChatBriefContext["tasks"],
    });
    notifyBriefRefresh(raw);
  }, [notifyBriefRefresh]);

  function buildTaskEditDrafts(
    edits: {
      task_id: number;
      title?: string;
      pillar: string;
      pillar_id: number | null;
      deadline?: string | null;
      note?: string | null;
    }[]
  ): TaskEditDraft[] {
    return edits
      .map((edit, i) => {
        const existing = chatBrief?.tasks.find((t) => t.id === edit.task_id);
        if (!existing) return null;

        const titleChanged = edit.title !== undefined;
        const deadlineChanged = edit.deadline !== undefined;
        const pillarChanged = edit.pillar_id !== null || edit.pillar !== "";
        const noteChanged = edit.note !== undefined;

        return {
          localId: `edit-${edit.task_id}-${i}`,
          task_id: edit.task_id,
          originalTitle: existing.title,
          title: titleChanged ? (edit.title ?? existing.title) : existing.title,
          pillar_id: pillarChanged ? edit.pillar_id : existing.pillar_id,
          pillar: pillarChanged ? edit.pillar : (existing.pillar_name ?? ""),
          deadline: deadlineChanged ? (edit.deadline ?? null) : existing.deadline,
          note: noteChanged ? (edit.note ?? null) : (existing.note ?? null),
          titleChanged,
          deadlineChanged,
          pillarChanged,
          noteChanged,
        };
      })
      .filter((row): row is TaskEditDraft => row !== null);
  }

  function openProposedTaskReview(
    drafts: ProposedTaskDraft[],
    source: "check-in" | "chat" = "chat"
  ) {
    if (drafts.length === 0) return;
    setProposedTasks(drafts);
    setProposedReviewSource(source);
    setProposedSaveError(null);
    setProposedReviewOpen(true);
  }

  function flushPendingTaskEdits() {
    setPendingTaskEdits((pending) => {
      if (pending.length > 0) {
        setTaskEdits(pending);
        setTaskEditsOpen(true);
      }
      return [];
    });
  }

  const openExtractedTaskNotesReview = useCallback(
    async (data: ExtractedTaskNotesApiData, idPrefix: string) => {
      const { noteUpdates, newTasks } = mapExtractedTaskNotes(data, idPrefix);
      if (noteUpdates.length === 0 && newTasks.length === 0) return false;

      let brief = chatBrief;
      if (!brief) {
        brief = await loadChatBrief(planDateRef.current);
        if (brief) setChatBrief(brief);
      }

      const briefTasks: ChatBriefContext["tasks"] =
        brief?.tasks ?? (await loadChatBrief(planDateRef.current))?.tasks ?? [];
      if (
        briefTasks.filter((t) => !t.completed_at).length === 0 &&
        noteUpdates.length > 0
      ) {
        return false;
      }

      setTaskNoteUpdates(noteUpdates);
      setNewTasksWithNotes(newTasks);
      setTaskNotesSaveError(null);
      setTaskNotesReviewOpen(true);
      return true;
    },
    [chatBrief, loadChatBrief]
  );

  const finalizeChatSession = useCallback(async (clearAfter = false) => {
    if (
      finalizeInFlightRef.current ||
      chatBusyRef.current ||
      taskNotesReviewOpenRef.current ||
      chatModeRef.current === "general" ||
      chatModeRef.current === "correction"
    ) {
      return;
    }

    const all = chatMessagesRef.current;
    const slice = all.slice(summarizedCountRef.current);
    const hasUser = slice.some((m) => m.role === "user");
    const hasExchange = slice.some((m) => m.role === "assistant") && hasUser;
    if (!hasExchange) return;

    finalizeInFlightRef.current = true;
    setSummarizingSession(true);
    pendingClearAfterRef.current = clearAfter;

    try {
      const res = await fetch("/api/mission/chat/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_date: planDateRef.current,
          messages: slice.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        summarizedCountRef.current = all.length;
        if (clearAfter) {
          setChatMessages([]);
          summarizedCountRef.current = 0;
        }
        return;
      }

      const opened = await openExtractedTaskNotesReview(data, "finalize");
      if (!opened) {
        summarizedCountRef.current = all.length;
        if (clearAfter) {
          setChatMessages([]);
          summarizedCountRef.current = 0;
        }
      }
    } catch {
      summarizedCountRef.current = all.length;
      if (clearAfter) {
        setChatMessages([]);
        summarizedCountRef.current = 0;
      }
    } finally {
      finalizeInFlightRef.current = false;
      setSummarizingSession(false);
    }
  }, [openExtractedTaskNotesReview]);

  const finalizeChatSessionRef = useRef(finalizeChatSession);
  finalizeChatSessionRef.current = finalizeChatSession;

  useEffect(() => {
    if (!enabled) return;
    const onPageHide = () => {
      void finalizeChatSessionRef.current(false);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void finalizeChatSessionRef.current(false);
      }
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  function closeFloatingChat() {
    void finalizeChatSession(false);
    setFloatingOpen(false);
  }

  function openFloatingChat() {
    setFloatingOpen(true);
  }

  function toggleFloatingChat() {
    if (floatingOpen) {
      closeFloatingChat();
    } else {
      openFloatingChat();
    }
  }

  async function confirmProposedTasks(tasks: ProposedTaskDraft[]) {
    if (tasks.length === 0) {
      setProposedReviewOpen(false);
      setProposedTasks([]);
      flushPendingTaskEdits();
      return;
    }

    setSavingProposed(true);
    setProposedSaveError(null);
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
      if (data.brief) applyChatBrief(data.brief);
      setProposedReviewOpen(false);
      setProposedTasks([]);
      flushPendingTaskEdits();
    } catch (err) {
      setProposedSaveError(
        err instanceof Error ? err.message : "Failed to save tasks"
      );
    } finally {
      setSavingProposed(false);
    }
  }

  async function confirmTaskEdits(edits: TaskEditDraft[]) {
    if (edits.length === 0) {
      setTaskEditsOpen(false);
      setTaskEdits([]);
      return;
    }

    setSavingTaskEdits(true);
    setTaskEditsSaveError(null);
    try {
      for (const edit of edits) {
        const body: Record<string, unknown> = {};
        if (edit.titleChanged) body.title = edit.title.trim();
        if (edit.deadlineChanged) body.deadline = edit.deadline;
        if (edit.pillarChanged) body.pillar_id = edit.pillar_id;
        if (edit.noteChanged) body.note = edit.note;
        if (Object.keys(body).length === 0) continue;
        const res = await fetch(`/api/tasks/${edit.task_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Could not save task");
        }
      }
      const brief = await loadChatBrief(planDate);
      if (brief) {
        applyChatBrief({
          today: brief.today,
          pillars: brief.pillars,
          milestones: brief.milestones,
          tasks: brief.tasks,
        });
      }
      setTaskEditsOpen(false);
      setTaskEdits([]);
    } catch (err) {
      setTaskEditsSaveError(
        err instanceof Error ? err.message : "Failed to save task changes"
      );
      const brief = await loadChatBrief(planDate);
      if (brief) {
        setChatBrief(brief);
      }
    } finally {
      setSavingTaskEdits(false);
    }
  }

  function markSessionSummarized(showNotice = false) {
    const all = chatMessagesRef.current;
    summarizedCountRef.current = all.length;

    if (showNotice) {
      setSessionSaveNotice("Notes saved to tasks");
      window.setTimeout(() => setSessionSaveNotice(null), 4500);
    }

    if (pendingClearAfterRef.current) {
      setChatMessages([]);
      summarizedCountRef.current = 0;
    }
    pendingClearAfterRef.current = false;
  }

  function dismissTaskNotesReview() {
    if (savingTaskNotes) return;
    setTaskNotesReviewOpen(false);
    setTaskNoteUpdates([]);
    setNewTasksWithNotes([]);
    setTaskNotesSaveError(null);
    markSessionSummarized(false);
  }

  async function confirmTaskNotes(
    noteUpdates: TaskNoteUpdateDraft[],
    newTasks: NewTaskNoteDraft[]
  ) {
    if (noteUpdates.length === 0 && newTasks.length === 0) {
      dismissTaskNotesReview();
      return;
    }

    setSavingTaskNotes(true);
    setTaskNotesSaveError(null);

    try {
      for (const row of noteUpdates) {
        const note = row.note.trim();
        if (!note) continue;

        const existing =
          chatBrief?.tasks.find((t) => t.id === row.task_id)?.note ??
          row.existing_note;
        const merged = appendTaskNote(existing, note, planDate);

        const res = await fetch(`/api/tasks/${row.task_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: merged }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Could not save task note");
        }
      }

      const tasksToCreate = newTasks.filter((t) => t.title.trim());
      if (tasksToCreate.length > 0) {
        const res = await fetch("/api/mission/proposed-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan_date: planDate,
            tasks: tasksToCreate.map((t) => ({
              title: t.title.trim(),
              pillar_id: t.pillar_id,
              deadline: t.deadline,
              bucket: t.bucket,
              note: t.note.trim()
                ? appendTaskNote(null, t.note.trim(), planDate)
                : null,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to create tasks");
        }
        if (data.brief) applyChatBrief(data.brief);
      } else {
        const brief = await loadChatBrief(planDate);
        if (brief) applyChatBrief(brief);
      }

      setTaskNotesReviewOpen(false);
      setTaskNoteUpdates([]);
      setNewTasksWithNotes([]);
      markSessionSummarized(true);
    } catch (err) {
      setTaskNotesSaveError(
        err instanceof Error ? err.message : "Failed to save notes"
      );
    } finally {
      setSavingTaskNotes(false);
    }
  }

  function dismissProposedReview() {
    if (savingProposed) return;
    setProposedReviewOpen(false);
    setProposedTasks([]);
    setProposedSaveError(null);
    flushPendingTaskEdits();
  }

  function dismissTaskEditsReview() {
    if (savingTaskEdits) return;
    setTaskEditsOpen(false);
    setTaskEdits([]);
    setTaskEditsSaveError(null);
  }

  function enterGeneralMode() {
    generalSessionStartRef.current = chatMessagesRef.current.length;
    correctionSessionStartRef.current = null;
    setCorrectionWeekLabel(null);
    copilotHandoffSummaryRef.current = null;
    setChatMode("general");
  }

  async function enterCorrectionMode() {
    generalSessionStartRef.current = null;
    copilotHandoffSummaryRef.current = null;
    correctionSessionStartRef.current = chatMessagesRef.current.length;
    setChatMode("correction");
    setChatError(null);

    try {
      const ctx = await loadCorrectionKickoff(planDateRef.current);
      setCorrectionWeekLabel(ctx.week_label);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-correction-kickoff-${Date.now()}`,
          role: "assistant",
          content: ctx.kickoff,
          mode: "correction",
        },
      ]);
    } catch (err) {
      correctionSessionStartRef.current = null;
      setCorrectionWeekLabel(null);
      setChatMode("copilot");
      throw err;
    }
  }

  function correctionSegmentMessages() {
    const start = correctionSessionStartRef.current ?? 0;
    return chatMessagesRef.current
      .slice(start)
      .map((m) => ({ role: m.role, content: m.content }));
  }

  async function openCorrectionProposeFlow() {
    const segment = correctionSegmentMessages();
    if (!segment.some((m) => m.role === "user")) return;

    setCorrectionProposing(true);
    setChatError(null);
    try {
      const rows = await proposeCorrectionsFromMessages(planDateRef.current, segment);
      if (rows.length === 0) {
        setChatError(
          "No matching records to update — try being more specific about what to fix."
        );
        return;
      }
      setCorrectionProposals(rows);
      setCorrectionSaveError(null);
      setCorrectionReviewOpen(true);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Propose failed");
    } finally {
      setCorrectionProposing(false);
    }
  }

  async function confirmCorrectionApply(corrections: ProposedCorrection[]) {
    setSavingCorrections(true);
    setCorrectionSaveError(null);
    try {
      const saved = await applyProposedCorrections(corrections);
      setCorrectionReviewOpen(false);
      setCorrectionProposals([]);
      setSessionSaveNotice(
        `Updated ${saved} record${saved === 1 ? "" : "s"}`
      );
      window.setTimeout(() => setSessionSaveNotice(null), 5000);
      notifyDailyLogChanged(planDateRef.current);
      const brief = await loadChatBrief(planDateRef.current);
      if (brief) applyChatBrief(brief);
    } catch (err) {
      setCorrectionSaveError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setSavingCorrections(false);
    }
  }

  function dismissCorrectionReview() {
    if (savingCorrections) return;
    setCorrectionReviewOpen(false);
    setCorrectionSaveError(null);
  }

  function exitCorrectionMode() {
    correctionSessionStartRef.current = null;
    setCorrectionWeekLabel(null);
  }

  async function performGeneralHandoff(): Promise<void> {
    const start = generalSessionStartRef.current;
    generalSessionStartRef.current = null;
    if (start === null) return;

    const all = chatMessagesRef.current;
    const segment = all.slice(start);
    if (segment.length === 0) return;

    if (!segment.some((m) => m.role === "user")) {
      setChatMessages(all.slice(0, start));
      return;
    }

    setHandoffBusy(true);
    setChatError(null);
    try {
      const res = await fetch("/api/mission/chat/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_date: planDateRef.current,
          messages: segment.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Handoff failed");
      }

      copilotHandoffSummaryRef.current =
        data.worth_keeping && data.summary ? String(data.summary) : null;

      setChatMessages((prev) => {
        const kept = prev.slice(0, start);
        if (data.reply?.trim()) {
          kept.push({
            id: `assistant-handoff-${Date.now()}`,
            role: "assistant",
            content: String(data.reply).trim(),
            mode: "copilot",
          });
        }
        return kept;
      });

      if (data.daily_log?.entry_id) {
        notifyDailyLogChanged(
          typeof data.daily_log.log_date === "string"
            ? data.daily_log.log_date
            : planDateRef.current
        );
        setSessionSaveNotice("Saved to daily log");
        window.setTimeout(() => setSessionSaveNotice(null), 4500);
      }

      await openExtractedTaskNotesReview(data, "handoff");
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Handoff failed");
    } finally {
      setHandoffBusy(false);
    }
  }

  async function switchToCopilotMode() {
    if (chatModeRef.current === "correction") {
      exitCorrectionMode();
      setChatMode("copilot");
      return;
    }
    if (chatModeRef.current !== "general") {
      setChatMode("copilot");
      return;
    }
    setChatMode("copilot");
    await performGeneralHandoff();
  }

  async function onChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = chatInput.trim();
    if (!raw || chatBusy || handoffBusy) return;

    const { modeSwitch, message, navigate, forcedSkill: slashForcedSkill } =
      parseChatSlashCommand(raw);
    let activeMode = chatMode;
    let turnForcedSkill: ForcedSkillId | null = slashForcedSkill ?? null;

    if (navigate) {
      setChatInput("");
      router.push(navigate);
      if (!message) return;
    }

    if (modeSwitch === "copilot" && chatMode === "general") {
      setChatInput("");
      setChatMode("copilot");
      await performGeneralHandoff();
      activeMode = "copilot";
      if (!message) return;
    } else if (modeSwitch === "copilot") {
      setChatInput("");
      exitCorrectionMode();
      setChatMode("copilot");
      activeMode = "copilot";
      if (!message) return;
    } else if (modeSwitch === "correction") {
      setChatInput("");
      if (chatMode !== "correction") {
        try {
          await enterCorrectionMode();
        } catch (err) {
          setChatError(
            err instanceof Error ? err.message : "Could not start correction"
          );
          return;
        }
      }
      activeMode = "correction";
      if (!message) return;
    } else if (modeSwitch === "general") {
      exitCorrectionMode();
      enterGeneralMode();
      activeMode = "general";
      if (!message) {
        setChatInput("");
        return;
      }
    } else if (modeSwitch) {
      setChatMode(modeSwitch);
      activeMode = modeSwitch;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      mode: activeMode,
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");

    setChatBusy(true);
    setChatError(null);

    try {
      if (activeMode === "copilot" && !chatBrief) {
        const brief = await loadChatBrief(planDate);
        if (brief) setChatBrief(brief);
      }

      const generalStart = generalSessionStartRef.current ?? 0;
      const correctionStart = correctionSessionStartRef.current ?? 0;
      const history =
        activeMode === "general"
          ? chatMessages.slice(generalStart).map((m) => ({
              role: m.role,
              content: m.content,
            }))
          : activeMode === "correction"
            ? chatMessages.slice(correctionStart).map((m) => ({
                role: m.role,
                content: m.content,
              }))
            : chatMessages
                .filter((m) => m.mode !== "general" && m.mode !== "correction")
                .map((m) => ({ role: m.role, content: m.content }));

      const handoffSummary =
        activeMode === "copilot" ? copilotHandoffSummaryRef.current : null;
      if (activeMode === "copilot") {
        copilotHandoffSummaryRef.current = null;
      }

      const res = await fetch("/api/mission/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          plan_date: planDate,
          mode: activeMode,
          forced_skill: turnForcedSkill,
          history,
          general_handoff_summary: handoffSummary,
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
          mode: activeMode,
        },
      ]);

      const shouldReviewTasks =
        activeMode === "copilot" ||
        turnForcedSkill === "create-task" ||
        turnForcedSkill === "edit-task" ||
        data.routed === "create-task" ||
        data.routed === "edit-task";

      if (!shouldReviewTasks) return;

      const taskDrafts: ProposedTaskDraft[] = (data.proposed_tasks ?? []).map(
        (
          task: {
            title: string;
            pillar: string;
            pillar_id: number | null;
            deadline: string | null;
            bucket: "Today" | "Next 7 days" | "Later";
          },
          i: number
        ) => ({
          localId: `chat-proposed-${i}-${task.title}`,
          title: task.title,
          pillar: task.pillar,
          pillar_id: task.pillar_id,
          deadline: task.deadline,
          bucket: task.bucket,
        })
      );

      const editDrafts = buildTaskEditDrafts(data.task_edits ?? []);

      if (taskDrafts.length > 0) {
        if (editDrafts.length > 0) {
          setPendingTaskEdits(editDrafts);
        }
        openProposedTaskReview(taskDrafts, "chat");
      } else if (editDrafts.length > 0) {
        setTaskEdits(editDrafts);
        setTaskEditsSaveError(null);
        setTaskEditsOpen(true);
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setChatBusy(false);
    }
  }

  async function toggleChatMode() {
    if (chatBusyRef.current || handoffBusyRef.current) return;
    if (chatModeRef.current === "correction") {
      exitCorrectionMode();
      setChatMode("copilot");
      return;
    }
    if (chatModeRef.current === "general") {
      await switchToCopilotMode();
    } else {
      enterGeneralMode();
    }
  }

  const correctionHasUserReply = chatMessages.some(
    (m) => m.mode === "correction" && m.role === "user"
  );

  const value: OpenChatContextValue = {
    planDate,
    chatInput,
    setChatInput,
    chatMessages,
    chatMode,
    toggleChatMode,
    chatBusy,
    handoffBusy,
    chatError,
    summarizingSession,
    sessionSaveNotice,
    correctionWeekLabel,
    correctionProposing,
    correctionHasUserReply,
    openCorrectionProposeFlow,
    floatingOpen,
    openFloatingChat,
    closeFloatingChat,
    toggleFloatingChat,
    onChatSubmit,
    chatBrief,
    proposedReviewOpen,
    proposedTasks,
    proposedReviewSource,
    savingProposed,
    proposedSaveError,
    confirmProposedTasks,
    dismissProposedReview,
    taskEditsOpen,
    taskEdits,
    savingTaskEdits,
    taskEditsSaveError,
    confirmTaskEdits,
    dismissTaskEditsReview,
    registerBriefRefresh,
    syncChatBrief,
    openCheckInProposedReview: (drafts) => openProposedTaskReview(drafts, "check-in"),
  };

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <OpenChatContext.Provider value={value}>
      {children}
      {taskNotesReviewOpen && chatBrief && (
        <ChatTaskNotesReviewModal
          key={`${taskNoteUpdates.map((r) => r.localId).join("|")}|${newTasksWithNotes.map((r) => r.localId).join("|")}`}
          noteUpdates={taskNoteUpdates}
          newTasks={newTasksWithNotes}
          openTasks={chatBrief.tasks.filter((t) => !t.completed_at)}
          pillars={chatBrief.pillars}
          planDate={planDate}
          saving={savingTaskNotes}
          saveError={taskNotesSaveError}
          onConfirm={confirmTaskNotes}
          onDismiss={dismissTaskNotesReview}
        />
      )}
      {proposedReviewOpen && chatBrief && (
        <ProposedTasksReviewModal
          key={proposedTasks.map((t) => t.localId).join("|")}
          tasks={proposedTasks}
          pillars={chatBrief.pillars}
          planDate={planDate}
          saving={savingProposed}
          source={proposedReviewSource}
          saveError={proposedSaveError}
          onConfirm={confirmProposedTasks}
          onDismiss={dismissProposedReview}
        />
      )}
      {taskEditsOpen && chatBrief && (
        <TaskEditsReviewModal
          key={taskEdits.map((t) => t.localId).join("|")}
          edits={taskEdits}
          pillars={chatBrief.pillars}
          saving={savingTaskEdits}
          saveError={taskEditsSaveError}
          onConfirm={confirmTaskEdits}
          onDismiss={dismissTaskEditsReview}
        />
      )}
      {correctionReviewOpen && (
        <CorrectionReviewModal
          corrections={correctionProposals}
          saving={savingCorrections}
          saveError={correctionSaveError}
          onConfirm={(rows) => void confirmCorrectionApply(rows)}
          onDismiss={dismissCorrectionReview}
        />
      )}
    </OpenChatContext.Provider>
  );
}

// Expose for MissionControl check-in proposed tasks flow
export function useOpenChatActions() {
  const ctx = useContext(OpenChatContext);
  return ctx;
}
