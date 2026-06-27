"use client";

import { useCallback, useRef, useState } from "react";
import ChatMarkdown from "../ChatMarkdown";
import CorrectionReviewModal from "../correction/CorrectionReviewModal";
import ThinkpadSaveModal, { type ThinkpadContext } from "./ThinkpadSaveModal";
import type { ThinkpadSaveTarget } from "../../lib/thinkpad-save";
import {
  applyProposedCorrections,
  loadCorrectionKickoff,
  proposeCorrectionsFromMessages,
  sendCorrectionChatMessage,
} from "../../lib/chat-correction-skill";
import { parseChatSlashCommand } from "../../lib/chat-mode";
import type { ProposedCorrection } from "../../lib/adk/propose-corrections";
import { todayIsoYyyyMmDd } from "../../lib/date";

type ThinkpadMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ThinkpadSkill = "general" | "correction";

export default function Thinkpad() {
  const [planDate] = useState(() => todayIsoYyyyMmDd());
  const [messages, setMessages] = useState<ThinkpadMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveSummary, setSaveSummary] = useState("");
  const [saveContext, setSaveContext] = useState<ThinkpadContext | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [skill, setSkill] = useState<ThinkpadSkill>("general");
  const [correctionWeekLabel, setCorrectionWeekLabel] = useState<string | null>(null);
  const [correctionProposing, setCorrectionProposing] = useState(false);
  const [correctionReviewOpen, setCorrectionReviewOpen] = useState(false);
  const [correctionProposals, setCorrectionProposals] = useState<ProposedCorrection[]>([]);
  const [savingCorrections, setSavingCorrections] = useState(false);
  const [correctionSaveError, setCorrectionSaveError] = useState<string | null>(null);
  const correctionStartRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    formRef.current?.requestSubmit();
  };

  const loadSaveContext = useCallback(async (): Promise<ThinkpadContext | null> => {
    const res = await fetch("/api/thinkpad/context");
    const data = await res.json();
    if (!res.ok || !data.ok) return null;
    return {
      pillars: data.pillars ?? [],
      milestones: data.milestones ?? [],
      tasks: data.tasks ?? [],
    };
  }, []);

  async function enterCorrectionSkill() {
    correctionStartRef.current = messages.length;
    setSkill("correction");
    const ctx = await loadCorrectionKickoff(planDate);
    setCorrectionWeekLabel(ctx.week_label);
    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-correction-kickoff-${Date.now()}`,
        role: "assistant",
        content: ctx.kickoff,
      },
    ]);
  }

  function exitCorrectionSkill() {
    correctionStartRef.current = null;
    setCorrectionWeekLabel(null);
    setSkill("general");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = input.trim();
    if (!raw || busy || summarizing || correctionProposing) return;

    const { modeSwitch, message } = parseChatSlashCommand(raw);
    let activeSkill = skill;

    if (modeSwitch === "correction") {
      setInput("");
      if (skill !== "correction") {
        try {
          await enterCorrectionSkill();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not start correction");
          return;
        }
      }
      activeSkill = "correction";
      if (!message) return;
    } else if (modeSwitch === "copilot" || modeSwitch === "general") {
      setInput("");
      if (skill === "correction") exitCorrectionSkill();
      activeSkill = "general";
      if (!message) return;
    } else if (modeSwitch) {
      setInput("");
      return;
    }

    const text = message || raw;
    const userMessage: ThinkpadMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      if (activeSkill === "correction") {
        const start = correctionStartRef.current ?? 0;
        const history = messages.slice(start).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const reply = await sendCorrectionChatMessage(planDate, text, history);
        setMessages((prev) => [
          ...prev,
          { id: `assistant-${Date.now()}`, role: "assistant", content: reply },
        ]);
        return;
      }

      const res = await fetch("/api/mission/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          plan_date: planDate,
          mode: "general",
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Chat failed");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: String(data.reply),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  }

  async function openSaveFlow() {
    if (messages.length === 0 || busy || summarizing) return;

    setSummarizing(true);
    setError(null);
    setSaveNotice(null);

    try {
      const [context, summarizeRes] = await Promise.all([
        loadSaveContext(),
        fetch("/api/thinkpad/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan_date: planDate,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
          }),
        }),
      ]);

      const summarizeData = await summarizeRes.json();
      if (!summarizeRes.ok || !summarizeData.ok) {
        throw new Error(summarizeData.error || "Could not summarize session");
      }

      if (!context) {
        throw new Error("Could not load save targets");
      }

      setSaveContext(context);
      setSaveSummary(String(summarizeData.summary));
      setSaveError(null);
      setSaveOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summarize failed");
    } finally {
      setSummarizing(false);
    }
  }

  function clearSession() {
    if (busy || summarizing || saving || correctionProposing) return;
    if (messages.length > 0 && !window.confirm("Clear this Thinkpad session?")) return;
    setMessages([]);
    exitCorrectionSkill();
    setError(null);
    setSaveNotice(null);
  }

  async function openCorrectionProposeFlow() {
    const start = correctionStartRef.current ?? 0;
    const segment = messages.slice(start).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    if (!segment.some((m) => m.role === "user")) return;

    setCorrectionProposing(true);
    setError(null);
    try {
      const rows = await proposeCorrectionsFromMessages(planDate, segment);
      if (rows.length === 0) {
        setError("No matching records to update — try being more specific about what to fix.");
        return;
      }
      setCorrectionProposals(rows);
      setCorrectionSaveError(null);
      setCorrectionReviewOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Propose failed");
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
      setSaveNotice(`Updated ${saved} record${saved === 1 ? "" : "s"}`);
      window.setTimeout(() => setSaveNotice(null), 5000);
    } catch (err) {
      setCorrectionSaveError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setSavingCorrections(false);
    }
  }

  const correctionHasUserReply =
    skill === "correction" &&
    messages.slice(correctionStartRef.current ?? 0).some((m) => m.role === "user");

  async function confirmSave(
    target: ThinkpadSaveTarget,
    targetId: number | null,
    summary: string
  ) {
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/thinkpad/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_date: planDate,
          target,
          target_id: targetId,
          summary,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Save failed");
      }

      setSaveOpen(false);
      setSaveNotice("Notes saved");
      window.setTimeout(() => setSaveNotice(null), 4500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="thinkpadLayout">
      <div className="thinkpadToolbar">
        <p className="thinkpadToolbarHint">
          {skill === "correction" ? (
            <>
              Correction
              {correctionWeekLabel ? (
                <>
                  {" "}
                  for <strong>{correctionWeekLabel}</strong>
                </>
              ) : null}
              — type <code className="chatModeHintCode">/copilot</code> to return to brainstorming.
            </>
          ) : (
            <>
              General-mode AI with your life snapshot — brainstorm freely, then save notes when
              you&apos;re done. Type <code className="chatModeHintCode">/correction</code> to fix
              recorded context.
            </>
          )}
        </p>
        <div className="thinkpadToolbarActions">
          {saveNotice && (
            <span className="missionChatSessionStatus missionChatSessionSaved">
              {saveNotice}
            </span>
          )}
          {skill === "correction" && (
            <button
              type="button"
              className="thinkpadToolbarBtn thinkpadToolbarBtnPrimary"
              onClick={() => void openCorrectionProposeFlow()}
              disabled={busy || correctionProposing || !correctionHasUserReply}
            >
              {correctionProposing ? "Finding records…" : "Apply corrections"}
            </button>
          )}
          <button
            type="button"
            className="thinkpadToolbarBtn"
            onClick={clearSession}
            disabled={busy || summarizing || saving || correctionProposing || messages.length === 0}
          >
            Clear
          </button>
          {skill !== "correction" && (
            <button
              type="button"
              className="thinkpadToolbarBtn thinkpadToolbarBtnPrimary"
              onClick={() => void openSaveFlow()}
              disabled={busy || summarizing || saving || messages.length === 0}
            >
              {summarizing ? "Summarizing…" : "Save notes"}
            </button>
          )}
        </div>
      </div>

      <div className="thinkpadMessages chatMessages" aria-live="polite">
        {messages.length === 0 && (
          <p className="thinkpadEmptyHint">
            Start a longer brainstorming or planning session — explore ideas without the
            co-pilot&apos;s scope, then save a summary to a task, milestone, pillar, or
            general notes.
          </p>
        )}
        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div
              key={message.id}
              className={`chatBubble ${isUser ? "chatBubbleUser" : "chatBubbleAssistant"}`}
            >
              {isUser ? (
                <p className="chatTextPart">{message.content}</p>
              ) : (
                <ChatMarkdown content={message.content} />
              )}
            </div>
          );
        })}
        {busy && (
          <div className="chatBubble chatBubbleAssistant">
            <p className="chatTextPart chatTextMuted">Thinking…</p>
          </div>
        )}
      </div>

      {error && (
        <div className="chatErrorBox thinkpadErrorBox">
          <strong>Error</strong>
          <p className="chatError">{error}</p>
        </div>
      )}

      <form ref={formRef} className="thinkpadForm chatForm" onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          className="chatInput thinkpadInput"
          rows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={
            skill === "correction"
              ? "What was recorded wrong or too vague?"
              : "What's on your mind? (/correction)"
          }
          disabled={busy || summarizing || correctionProposing}
        />
        <button
          className="chatSendBtn"
          type="submit"
          disabled={busy || summarizing || correctionProposing || !input.trim()}
        >
          {busy ? "..." : "Send"}
        </button>
      </form>

      {saveOpen && saveContext && (
        <ThinkpadSaveModal
          summary={saveSummary}
          context={saveContext}
          saving={saving}
          saveError={saveError}
          onConfirm={confirmSave}
          onDismiss={() => {
            if (saving) return;
            setSaveOpen(false);
            setSaveError(null);
          }}
        />
      )}
      {correctionReviewOpen && (
        <CorrectionReviewModal
          corrections={correctionProposals}
          saving={savingCorrections}
          saveError={correctionSaveError}
          onConfirm={(rows) => void confirmCorrectionApply(rows)}
          onDismiss={() => {
            if (savingCorrections) return;
            setCorrectionReviewOpen(false);
            setCorrectionSaveError(null);
          }}
        />
      )}
    </div>
  );
}
