"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatMarkdown from "../ChatMarkdown";
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
};

export default function Reflection() {
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reflection/context?plan_date=${encodeURIComponent(planDate)}`
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not load week context");
      }

      setWeekContext({
        week_monday: data.week_monday,
        week_end: data.week_end,
        week_label: data.week_label,
        kickoff: data.kickoff,
      });

      setMessages([
        {
          id: "kickoff",
          role: "assistant",
          content: String(data.kickoff),
        },
      ]);
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
    if (!text || busy || summarizing || saving || !weekContext) return;

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
      const res = await fetch("/api/reflection/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          plan_date: planDate,
          week_monday: weekContext.week_monday,
          week_end: weekContext.week_end,
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

  function clearSession() {
    if (busy || summarizing || saving) return;
    if (messages.length > 1 && !window.confirm("Start over? Your conversation will be cleared.")) {
      return;
    }
    void loadContext();
    setSaveNotice(null);
    setSaveOpen(false);
  }

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

      setSaveOpen(false);
      setSaveNotice("Weekly reflection saved to your daily log");
      window.setTimeout(() => setSaveNotice(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
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
              Reviewing week of <strong>{weekContext.week_label}</strong>
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
          <button
            type="button"
            className="thinkpadToolbarBtn"
            onClick={clearSession}
            disabled={loading || busy || summarizing || saving || messages.length <= 1}
          >
            Start over
          </button>
          <button
            type="button"
            className="thinkpadToolbarBtn thinkpadToolbarBtnPrimary"
            onClick={() => void openSaveFlow()}
            disabled={
              loading || busy || summarizing || saving || !hasUserReply
            }
          >
            {summarizing ? "Summarizing…" : "Save reflection"}
          </button>
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
          placeholder="Share your thoughts — wins, misses, focus areas…"
          disabled={loading || busy || summarizing || saving || !weekContext}
        />
        <button
          className="chatSendBtn"
          type="submit"
          disabled={loading || busy || summarizing || saving || !input.trim() || !weekContext}
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
    </div>
  );
}
