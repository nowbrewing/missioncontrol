"use client";

import { useCallback, useRef, useState } from "react";
import ChatMarkdown from "../ChatMarkdown";
import ThinkpadSaveModal, { type ThinkpadContext } from "./ThinkpadSaveModal";
import type { ThinkpadSaveTarget } from "../../lib/thinkpad-save";
import { todayIsoYyyyMmDd } from "../../lib/date";

type ThinkpadMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy || summarizing) return;

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
    if (busy || summarizing || saving) return;
    if (messages.length > 0 && !window.confirm("Clear this Thinkpad session?")) return;
    setMessages([]);
    setError(null);
    setSaveNotice(null);
  }

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
          General-mode AI with your life snapshot — brainstorm freely, then save notes when
          you&apos;re done.
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
            disabled={busy || summarizing || saving || messages.length === 0}
          >
            Clear
          </button>
          <button
            type="button"
            className="thinkpadToolbarBtn thinkpadToolbarBtnPrimary"
            onClick={() => void openSaveFlow()}
            disabled={busy || summarizing || saving || messages.length === 0}
          >
            {summarizing ? "Summarizing…" : "Save notes"}
          </button>
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
          placeholder="What's on your mind?"
          disabled={busy || summarizing}
        />
        <button
          className="chatSendBtn"
          type="submit"
          disabled={busy || summarizing || !input.trim()}
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
    </div>
  );
}
