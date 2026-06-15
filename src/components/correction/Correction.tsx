"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatMarkdown from "../ChatMarkdown";
import CorrectionReviewModal from "./CorrectionReviewModal";
import type { ProposedCorrection } from "../../lib/adk/propose-corrections";
import { todayIsoYyyyMmDd } from "../../lib/date";

type CorrectionMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type CorrectionContext = {
  week_monday: string;
  week_end: string;
  week_label: string;
  kickoff: string;
};

export default function Correction() {
  const [planDate] = useState(() => todayIsoYyyyMmDd());
  const [weekContext, setWeekContext] = useState<CorrectionContext | null>(null);
  const [messages, setMessages] = useState<CorrectionMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ProposedCorrection[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/correction/context?plan_date=${encodeURIComponent(planDate)}`
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not load correction context");
      }

      setWeekContext({
        week_monday: data.week_monday,
        week_end: data.week_end,
        week_label: data.week_label,
        kickoff: data.kickoff,
      });

      setMessages([{ id: "kickoff", role: "assistant", content: String(data.kickoff) }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [planDate]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    formRef.current?.requestSubmit();
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy || proposing || saving) return;

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", content: text }]);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/correction/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          plan_date: planDate,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Chat failed");

      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: "assistant", content: String(data.reply) },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  }

  async function openProposeFlow() {
    if (messages.length < 2 || busy || proposing) return;

    setProposing(true);
    setError(null);
    setSaveNotice(null);

    try {
      const res = await fetch("/api/correction/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_date: planDate,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not propose corrections");

      const rows: ProposedCorrection[] = data.corrections ?? [];
      if (rows.length === 0) {
        setError("No matching records to update — try being more specific about what to fix.");
        return;
      }

      setProposals(rows);
      setSaveError(null);
      setReviewOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Propose failed");
    } finally {
      setProposing(false);
    }
  }

  async function confirmApply(corrections: ProposedCorrection[]) {
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/correction/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corrections }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Apply failed");

      setReviewOpen(false);
      setProposals([]);
      setSaveNotice(
        `Updated ${data.saved ?? corrections.length} record${data.saved === 1 ? "" : "s"}`
      );
      window.setTimeout(() => setSaveNotice(null), 5000);
      void loadContext();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setSaving(false);
    }
  }

  const hasUserReply = messages.some((m) => m.role === "user");

  return (
    <div className="thinkpadLayout">
      <div className="thinkpadToolbar">
        <p className="thinkpadToolbarHint">
          {weekContext ? (
            <>
              Correcting records for <strong>{weekContext.week_label}</strong> — clarify what was
              wrong, then apply fixes.
            </>
          ) : (
            "Loading…"
          )}
        </p>
        <div className="thinkpadToolbarActions">
          {saveNotice && (
            <span className="missionChatSessionStatus missionChatSessionSaved">{saveNotice}</span>
          )}
          <button
            type="button"
            className="thinkpadToolbarBtn thinkpadToolbarBtnPrimary"
            onClick={() => void openProposeFlow()}
            disabled={loading || busy || proposing || saving || !hasUserReply}
          >
            {proposing ? "Finding records…" : "Apply corrections"}
          </button>
        </div>
      </div>

      <div className="thinkpadMessages chatMessages" aria-live="polite">
        {loading && messages.length === 0 && (
          <p className="thinkpadEmptyHint">Loading this week&apos;s recorded context…</p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`chatBubble ${message.role === "user" ? "chatBubbleUser" : "chatBubbleAssistant"}`}
          >
            {message.role === "user" ? (
              <p className="chatTextPart">{message.content}</p>
            ) : (
              <ChatMarkdown content={message.content} />
            )}
          </div>
        ))}
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
          className="chatInput thinkpadInput"
          rows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="What was recorded wrong or too vague?"
          disabled={loading || busy || proposing || saving}
        />
        <button
          className="chatSendBtn"
          type="submit"
          disabled={loading || busy || proposing || saving || !input.trim()}
        >
          {busy ? "..." : "Send"}
        </button>
      </form>

      {reviewOpen && (
        <CorrectionReviewModal
          corrections={proposals}
          saving={saving}
          saveError={saveError}
          onConfirm={(rows) => void confirmApply(rows)}
          onDismiss={() => {
            if (saving) return;
            setReviewOpen(false);
            setSaveError(null);
          }}
        />
      )}
    </div>
  );
}
