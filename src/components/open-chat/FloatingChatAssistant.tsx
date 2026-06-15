"use client";

import { useEffect, useRef } from "react";
import { useOpenChat } from "./OpenChatProvider";
import OpenChatPanel from "./OpenChatPanel";

export default function FloatingChatAssistant() {
  const {
    floatingOpen,
    toggleFloatingChat,
    closeFloatingChat,
    chatMode,
    summarizingSession,
    sessionSaveNotice,
    handoffBusy,
  } = useOpenChat();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!floatingOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeFloatingChat();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [floatingOpen, closeFloatingChat]);

  return (
    <>
      {floatingOpen && (
        <button
          type="button"
          className="floatingChatBackdrop"
          aria-label="Close chat"
          onClick={closeFloatingChat}
        />
      )}

      <div
        ref={panelRef}
        className={`floatingChatPanel ${floatingOpen ? "floatingChatPanelOpen" : ""}`}
        role="dialog"
        aria-label="Co-pilot chat"
        aria-hidden={!floatingOpen}
      >
        <header className="floatingChatPanelHeader">
          <div className="floatingChatPanelTitleWrap">
            <h2 className="floatingChatPanelTitle">
              {chatMode === "general" ? "General chat" : "Co-pilot"}
            </h2>
            {summarizingSession && (
              <span className="missionChatSessionStatus">Finding notes…</span>
            )}
            {!summarizingSession && handoffBusy && (
              <span className="missionChatSessionStatus">Reviewing general chat…</span>
            )}
            {!summarizingSession && !handoffBusy && sessionSaveNotice && (
              <span className="missionChatSessionStatus missionChatSessionSaved">
                {sessionSaveNotice}
              </span>
            )}
          </div>
          <button
            type="button"
            className="floatingChatCloseBtn"
            onClick={closeFloatingChat}
            aria-label="Close chat"
            disabled={summarizingSession || handoffBusy}
          >
            ×
          </button>
        </header>
        <div className="floatingChatPanelBody">
          <OpenChatPanel variant="floating" />
        </div>
      </div>

      <button
        type="button"
        className={`floatingChatFab ${floatingOpen ? "floatingChatFabOpen" : ""}`}
        onClick={toggleFloatingChat}
        aria-label={floatingOpen ? "Close chat" : "Open co-pilot chat"}
        aria-expanded={floatingOpen}
        disabled={summarizingSession || handoffBusy}
      >
        <span className="floatingChatFabIcon" aria-hidden>
          {floatingOpen ? "×" : "💬"}
        </span>
      </button>
    </>
  );
}
