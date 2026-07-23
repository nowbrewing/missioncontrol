"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ChatMarkdown from "../ChatMarkdown";
import CorrectionReviewModal from "../correction/CorrectionReviewModal";
import {
  applyProposedCorrections,
  loadCorrectionKickoff,
  proposeCorrectionsFromMessages,
  sendCorrectionChatMessage,
} from "../../lib/chat-correction-skill";
import { parseChatSlashCommand } from "../../lib/chat-mode";
import type { ProposedCorrection } from "../../lib/adk/propose-corrections";
import { todayIsoYyyyMmDd } from "../../lib/date";

type ReflectionMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ReflectionContext = {
  week_monday: string;
  week_end: string;
  week_label: string;
  kickoff: string;
  pillar_id: number | null;
  pillar_name: string | null;
};

type ReflectionSkill = "reflection" | "correction";

function sessionFingerprint(ctx: ReflectionContext, messages: ReflectionMessage[]) {
  return JSON.stringify({
    week: ctx.week_monday,
    pillar: ctx.pillar_id,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
}

export default function Reflection() {
  const searchParams = useSearchParams();
  const pillarParam = searchParams.get("pillar");
  const pillarIdRaw = pillarParam ? Number(pillarParam) : null;
  const pillarId =
    pillarIdRaw != null && Number.isFinite(pillarIdRaw) ? pillarIdRaw : null;

  const [planDate] = useState(() => todayIsoYyyyMmDd());
  const [weekContext, setWeekContext] = useState<ReflectionContext | null>(null);
  const [messages, setMessages] = useState<ReflectionMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveSummary, setSaveSummary] = useState("");
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [skill, setSkill] = useState<ReflectionSkill>("reflection");
  const [correctionWeekLabel, setCorrectionWeekLabel] = useState<string | null>(null);
  const [correctionProposing, setCorrectionProposing] = useState(false);
  const [correctionReviewOpen, setCorrectionReviewOpen] = useState(false);
  const [correctionProposals, setCorrectionProposals] = useState<ProposedCorrection[]>([]);
  const [savingCorrections, setSavingCorrections] = useState(false);
  const [correctionSaveError, setCorrectionSaveError] = useState<string | null>(null);
  const correctionStartRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const weekContextRef = useRef(weekContext);
  const messagesRef = useRef(messages);
  const skillRef = useRef(skill);
  const busyRef = useRef(busy);
  const savedFingerprintRef = useRef<string>("");
  const autosaveInFlightRef = useRef(false);
  const skipAutosaveRef = useRef(false);

  weekContextRef.current = weekContext;
  messagesRef.current = messages;
  skillRef.current = skill;
  busyRef.current = busy;

  const markSaved = useCallback((ctx: ReflectionContext, msgs: ReflectionMessage[]) => {
    savedFingerprintRef.current = sessionFingerprint(ctx, msgs);
  }, []);

  const autosaveSession = useCallback(async (opts?: { quiet?: boolean }) => {
    if (autosaveInFlightRef.current || skipAutosaveRef.current) return false;
    if (skillRef.current === "correction") return false;
    if (busyRef.current) return false;

    const ctx = weekContextRef.current;
    const msgs = messagesRef.current;
    if (!ctx || !msgs.some((m) => m.role === "user")) return false;

    const fingerprint = sessionFingerprint(ctx, msgs);
    if (fingerprint === savedFingerprintRef.current) return false;

    autosaveInFlightRef.current = true;
    if (!opts?.quiet) {
      setSaving(true);
      setSaveNotice(null);
      setError(null);
    }

    try {
      const res = await fetch("/api/reflection/autosave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_monday: ctx.week_monday,
          week_end: ctx.week_end,
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        }),
        keepalive: true,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        if (!opts?.quiet) {
          throw new Error(data?.error || "Autosave failed");
        }
        return false;
      }
      if (data.skipped) return false;

      markSaved(ctx, msgs);
      if (!opts?.quiet) {
        setSaveNotice("Reflection auto-saved");
        window.setTimeout(() => setSaveNotice(null), 5000);
      }
      return true;
    } catch (err) {
      if (!opts?.quiet) {
        setError(err instanceof Error ? err.message : "Autosave failed");
      }
      return false;
    } finally {
      autosaveInFlightRef.current = false;
      if (!opts?.quiet) setSaving(false);
    }
  }, [markSaved]);

  const autosaveSessionRef = useRef(autosaveSession);
  autosaveSessionRef.current = autosaveSession;

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ plan_date: planDate });
      if (pillarId != null) params.set("pillar", String(pillarId));
      const res = await fetch(`/api/reflection/context?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not load week context");
      }

      const nextCtx: ReflectionContext = {
        week_monday: data.week_monday,
        week_end: data.week_end,
        week_label: data.week_label,
        kickoff: data.kickoff,
        pillar_id: data.pillar_id ?? null,
        pillar_name: data.pillar_name ?? null,
      };
      const kickoffMessages: ReflectionMessage[] = [
        {
          id: "kickoff",
          role: "assistant",
          content: String(data.kickoff),
        },
      ];

      setWeekContext(nextCtx);
      setMessages(kickoffMessages);
      markSaved(nextCtx, kickoffMessages);
      setSaveOpen(false);
      setSaveSummary("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [planDate, pillarId, markSaved]);

  useEffect(() => {
    void loadContext();
    return () => {
      void autosaveSessionRef.current({ quiet: true });
    };
  }, [loadContext]);

  useEffect(() => {
    const flush = () => {
      void autosaveSessionRef.current({ quiet: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    formRef.current?.requestSubmit();
  };

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
    setSkill("reflection");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = input.trim();
    if (!raw || busy || summarizing || saving || correctionProposing || !weekContext) return;

    let message = raw;
    let activeSkill = skill;

    if (skill === "correction" && /^\/reflection\b/i.test(raw)) {
      setInput("");
      exitCorrectionSkill();
      activeSkill = "reflection";
      message = raw.replace(/^\/reflection\b/i, "").trim();
      if (!message) return;
    } else {
      const { modeSwitch, message: parsedMessage, navigate } = parseChatSlashCommand(raw);
      if (navigate) {
        setInput("");
        void autosaveSession({ quiet: true });
        return;
      }
      message = parsedMessage;

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
      } else if (modeSwitch === "copilot") {
        setInput("");
        if (skill === "correction") exitCorrectionSkill();
        activeSkill = "reflection";
        if (!message) return;
      } else if (modeSwitch) {
        setInput("");
        return;
      }
    }

    const text = message;
    const userMessage: ReflectionMessage = {
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

      const res = await fetch("/api/reflection/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          plan_date: planDate,
          week_monday: weekContext.week_monday,
          week_end: weekContext.week_end,
          pillar_id: weekContext.pillar_id,
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
    if (!weekContext || messages.length < 2 || busy || summarizing) return;

    setSummarizing(true);
    setError(null);
    setSaveNotice(null);

    try {
      const res = await fetch("/api/reflection/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_monday: weekContext.week_monday,
          week_end: weekContext.week_end,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not summarize session");
      }

      setSaveSummary(String(data.summary));
      setSaveOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summarize failed");
    } finally {
      setSummarizing(false);
    }
  }

  async function clearSession() {
    if (busy || summarizing || saving || correctionProposing) return;
    if (messages.length > 1 && !window.confirm("Start over? Your conversation will be cleared.")) {
      return;
    }
    skipAutosaveRef.current = true;
    exitCorrectionSkill();
    setSaveNotice(null);
    setSaveOpen(false);
    await loadContext();
    skipAutosaveRef.current = false;
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

  const hasUserReply = messages.some((m) => m.role === "user");
  const correctionHasUserReply =
    skill === "correction" &&
    messages.slice(correctionStartRef.current ?? 0).some((m) => m.role === "user");

  async function confirmSave() {
    if (!weekContext || !saveSummary.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/reflection/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_monday: weekContext.week_monday,
          week_end: weekContext.week_end,
          summary: saveSummary.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Save failed");
      }

      markSaved(weekContext, messages);
      setSaveOpen(false);
      setSaveNotice("Weekly reflection saved to your daily log");
      window.setTimeout(() => setSaveNotice(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
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
              — type <code className="chatModeHintCode">/reflection</code> to return.
            </>
          ) : weekContext ? (
            <>
              {weekContext.pillar_name ? (
                <>
                  Journaling <strong>{weekContext.pillar_name}</strong> · week of{" "}
                  <strong>{weekContext.week_label}</strong>
                </>
              ) : (
                <>
                  Reviewing week of <strong>{weekContext.week_label}</strong>
                </>
              )}{" "}
              — auto-saves when you leave. Type{" "}
              <code className="chatModeHintCode">/correction</code> to fix recorded context.
            </>
          ) : (
            "Loading your week…"
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
              disabled={loading || busy || correctionProposing || !correctionHasUserReply}
            >
              {correctionProposing ? "Finding records…" : "Apply corrections"}
            </button>
          )}
          <button
            type="button"
            className="thinkpadToolbarBtn"
            onClick={() => void clearSession()}
            disabled={
              loading ||
              busy ||
              summarizing ||
              saving ||
              correctionProposing ||
              messages.length <= 1
            }
          >
            Start over
          </button>
          {skill !== "correction" && (
            <button
              type="button"
              className="thinkpadToolbarBtn thinkpadToolbarBtnPrimary"
              onClick={() => void openSaveFlow()}
              disabled={
                loading || busy || summarizing || saving || !hasUserReply
              }
            >
              {summarizing ? "Summarizing…" : saving ? "Saving…" : "Save now"}
            </button>
          )}
        </div>
      </div>

      <div className="thinkpadMessages chatMessages" aria-live="polite">
        {loading && messages.length === 0 && (
          <p className="thinkpadEmptyHint">Loading your week review…</p>
        )}
        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div
              key={message.id}
              className={`chatBubble ${isUser ? "chatBubbleUser" : "chatBubbleAssistant"}${message.id === "kickoff" ? " reflectionRecapKickoff" : ""}`}
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
              : "Share your thoughts — wins, misses, focus areas… (/correction)"
          }
          disabled={
            loading || busy || summarizing || saving || correctionProposing || !weekContext
          }
        />
        <button
          className="chatSendBtn"
          type="submit"
          disabled={
            loading ||
            busy ||
            summarizing ||
            saving ||
            correctionProposing ||
            !input.trim() ||
            !weekContext
          }
        >
          {busy ? "..." : "Send"}
        </button>
      </form>

      {saveOpen && (
        <div className="modalBackdrop" role="presentation" onClick={() => !saving && setSaveOpen(false)}>
          <div
            className="modal thinkpadSaveModal"
            role="dialog"
            aria-labelledby="reflection-save-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="reflection-save-title" className="modalTitle">
              Save weekly reflection
            </h2>
            <p className="modalHint">
              This will be saved to your daily log as a weekly summary
              {weekContext ? ` for ${weekContext.week_label}` : ""}. Relevant pillar context
              will be updated automatically.
            </p>
            <textarea
              className="chatInput thinkpadSummaryInput"
              rows={12}
              value={saveSummary}
              onChange={(e) => setSaveSummary(e.target.value)}
              disabled={saving}
            />
            <div className="modalActions">
              <button
                type="button"
                className="outlineButton"
                onClick={() => setSaveOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="chatSendBtn"
                onClick={() => void confirmSave()}
                disabled={saving || !saveSummary.trim()}
              >
                {saving ? "Saving…" : "Save to daily log"}
              </button>
            </div>
          </div>
        </div>
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
