"use client";

import { useEffect, useRef, useState } from "react";
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
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!floatingOpen) setExpanded(false);
  }, [floatingOpen]);

  useEffect(() => {
    if (!floatingOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (expanded) {
          setExpanded(false);
        } else {
          closeFloatingChat();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [floatingOpen, closeFloatingChat, expanded]);

  function handleClose() {
    setExpanded(false);
    closeFloatingChat();
  }

  return (
    <>
      {floatingOpen && !expanded && (
        <button
          type="button"
          className="floatingChatBackdrop"
          aria-label="Close chat"
          onClick={handleClose}
        />
      )}

      <div
        ref={panelRef}
        className={`floatingChatPanel ${floatingOpen ? "floatingChatPanelOpen" : ""} ${
          expanded ? "floatingChatPanelExpanded" : ""
        }`}
        role="dialog"
        aria-label="Co-pilot chat"
        aria-hidden={!floatingOpen}
      >
        <header className="floatingChatPanelHeader">
          <div className="floatingChatPanelTitleWrap">
            <h2 className="floatingChatPanelTitle">
              {chatMode === "correction"
                ? "Correction"
                : chatMode === "general"
                  ? "General chat"
                  : "Co-pilot"}
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
          <div className="floatingChatPanelHeaderActions">
            <button
              type="button"
              className="floatingChatExpandBtn"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Exit full screen" : "Full screen"}
              disabled={summarizingSession || handoffBusy}
            >
              {expanded ? "Shrink" : "Expand"}
            </button>
            <button
              type="button"
              className="floatingChatCloseBtn"
              onClick={handleClose}
              aria-label="Close chat"
              disabled={summarizingSession || handoffBusy}
            >
              ×
            </button>
          </div>
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
