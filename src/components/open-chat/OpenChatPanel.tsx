"use client";

import { useEffect, useRef } from "react";
import ChatMarkdown from "../ChatMarkdown";
import { useOpenChat } from "./OpenChatProvider";

type OpenChatPanelProps = {
  variant?: "inline" | "floating";
  showSubtext?: boolean;
};

export default function OpenChatPanel({
  variant = "inline",
  showSubtext = true,
}: OpenChatPanelProps) {
  const {
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
    onChatSubmit,
  } = useOpenChat();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    formRef.current?.requestSubmit();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.key.toLowerCase() !== "g") {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        if (target !== inputRef.current) return;
      }
      e.preventDefault();
      toggleChatMode();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggleChatMode]);

  const messagesClass =
    variant === "floating"
      ? "chatMessages floatingChatMessages"
      : "chatMessages missionChatMessages";
  const formClass =
    variant === "floating" ? "chatForm floatingChatForm" : "chatForm missionChatForm";
  const inputClass =
    variant === "floating" ? "chatInput floatingChatInput" : "chatInput missionChatInput";
  const isGeneral = chatMode === "general";
  const isCorrection = chatMode === "correction";

  return (
    <>
      {showSubtext && variant === "inline" && (
        <p
          className="missionChatHeroSubtext"
          title={
            isCorrection
              ? "Fix recorded context — type /copilot to return to co-pilot."
              : isGeneral
                ? "Plain model with a brief life snapshot — no co-pilot persona. Type /copilot to switch back."
                : "Open conversation — think out loud, reflect, or go deep on a pillar. Type /general for plain model access."
          }
        >
          {isCorrection ? (
            <>
              Fixing what was recorded wrong or too vague
              {correctionWeekLabel ? (
                <>
                  {" "}
                  for <strong>{correctionWeekLabel}</strong>
                </>
              ) : null}
              . Type <code className="chatModeHintCode">/copilot</code> when you&apos;re done.
            </>
          ) : isGeneral ? (
            <>
              Plain model with your pillars and top-of-mind snapshot — no co-pilot persona. Type{" "}
              <code className="chatModeHintCode">/copilot</code> to switch back; the co-pilot
              reviews what you discussed and keeps only what&apos;s relevant.
            </>
          ) : (
            <>
              Think out loud or go deep on a pillar — the Life Agent routes to skills when needed. Type{" "}
              <code className="chatModeHintCode">/general</code>,{" "}
              <code className="chatModeHintCode">/life-pillar</code>,{" "}
              <code className="chatModeHintCode">/create-task</code>,{" "}
              <code className="chatModeHintCode">/edit-task</code>, or{" "}
              <code className="chatModeHintCode">/correction</code>.
            </>
          )}
        </p>
      )}

      {showSubtext && variant === "floating" && (
        <p className="floatingChatSubtext">
          {isCorrection ? (
            <>
              Correction mode — type <code className="chatModeHintCode">/copilot</code> to return.
            </>
          ) : isGeneral ? (
            <>
              Plain model + life snapshot — type <code className="chatModeHintCode">/copilot</code>{" "}
              to switch back; the co-pilot reviews and keeps only what&apos;s relevant.
            </>
          ) : (
            <>
              Ask anything — Life Agent routes skills via slash commands.
            </>
          )}
        </p>
      )}

      {(isCorrection || sessionSaveNotice) && (
        <div className="thinkpadToolbar missionChatCorrectionBar">
          {sessionSaveNotice && (
            <span className="missionChatSessionStatus missionChatSessionSaved">
              {sessionSaveNotice}
            </span>
          )}
          {isCorrection && (
            <button
              type="button"
              className="thinkpadToolbarBtn thinkpadToolbarBtnPrimary"
              onClick={() => void openCorrectionProposeFlow()}
              disabled={
                chatBusy || handoffBusy || correctionProposing || !correctionHasUserReply
              }
            >
              {correctionProposing ? "Finding records…" : "Apply corrections"}
            </button>
          )}
        </div>
      )}

      <div className={messagesClass} aria-live="polite">
        {chatMessages.length === 0 && (
          <p className={variant === "floating" ? "floatingChatEmptyHint" : "missionChatEmptyHint"}>
            {isCorrection
              ? "What was recorded wrong or too vague?"
              : isGeneral
                ? "Ask anything — plain model with a brief pillars & top-of-mind snapshot."
                : 'e.g. "I\'ve been spinning on the hackathon pitch — help me untangle what actually matters"'}
          </p>
        )}
        {chatMessages.map((message) => {
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
        {chatBusy && (
          <div className="chatBubble chatBubbleAssistant">
            <p className="chatTextPart chatTextMuted">Thinking…</p>
          </div>
        )}
        {handoffBusy && (
          <div className="chatBubble chatBubbleAssistant">
            <p className="chatTextPart chatTextMuted">Reviewing general chat…</p>
          </div>
        )}
      </div>

      {chatError && (
        <div className="chatErrorBox">
          <strong>Assistant error</strong>
          <p className="chatError">{chatError}</p>
        </div>
      )}

      <form ref={formRef} className={formClass} onSubmit={onChatSubmit}>
        <div className="chatFormInputRow">
          {isCorrection && (
            <span className="chatModeBadge" title="Fix recorded logs, notes, and pillar context">
              Correction
            </span>
          )}
          {isGeneral && (
            <span className="chatModeBadge" title="Plain model with life snapshot — no co-pilot persona">
              General
            </span>
          )}
          <textarea
            ref={inputRef}
            className={inputClass}
            rows={variant === "floating" ? 2 : 3}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={
              isCorrection
                ? "What was recorded wrong or too vague?"
                : isGeneral
                  ? "Ask anything (plain model + life snapshot)…"
                  : "What's on your mind? (/general, /life-pillar, /create-task…)"
            }
            disabled={chatBusy || handoffBusy || summarizingSession || correctionProposing}
          />
        </div>
        <button
          className="chatSendBtn"
          type="submit"
          disabled={
            chatBusy ||
            handoffBusy ||
            summarizingSession ||
            correctionProposing ||
            !chatInput.trim()
          }
        >
          {chatBusy || handoffBusy ? "..." : "Send"}
        </button>
      </form>
    </>
  );
}
