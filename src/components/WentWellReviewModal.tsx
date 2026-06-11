"use client";

import { useState } from "react";
import PillarChip from "./PillarChip";

export type WentWellDraft = {
  localId: string;
  content: string;
  pillar_ids: number[];
};

type Pillar = {
  id: number;
  name: string;
  abbreviation?: string | null;
  color: string;
};

function isGeneral(pillarIds: number[]) {
  return pillarIds.length === 0;
}

export default function WentWellReviewModal({
  statements: initialStatements,
  pillars,
  logDate,
  saving,
  onConfirm,
  onDismiss,
}: {
  statements: WentWellDraft[];
  pillars: Pillar[];
  logDate: string;
  saving: boolean;
  onConfirm: (statements: WentWellDraft[]) => void;
  onDismiss: () => void;
}) {
  const [statements, setStatements] = useState(initialStatements);

  function updateStatement(localId: string, patch: Partial<WentWellDraft>) {
    setStatements((prev) =>
      prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s))
    );
  }

  function removeStatement(localId: string) {
    setStatements((prev) => prev.filter((s) => s.localId !== localId));
  }

  function setGeneral(localId: string) {
    updateStatement(localId, { pillar_ids: [] });
  }

  function togglePillar(localId: string, pillarId: number) {
    setStatements((prev) =>
      prev.map((s) => {
        if (s.localId !== localId) return s;
        const has = s.pillar_ids.includes(pillarId);
        const pillar_ids = has
          ? s.pillar_ids.filter((id) => id !== pillarId)
          : [...s.pillar_ids, pillarId].sort((a, b) => a - b);
        return { ...s, pillar_ids };
      })
    );
  }

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="went-well-title"
      onClick={(e) => e.target === e.currentTarget && !saving && onDismiss()}
    >
      <div className="modalCard proposedTasksModal wentWellReviewModal">
        <h2 id="went-well-title" className="modalTitle">
          Review wins
        </h2>
        <p className="modalNote">
          We split your wins into statements and suggested pillars. Edit the text,
          tag one or more pillars, or leave as <strong>General</strong> for
          cross-cutting wins. Saved for future reflection — not matched to tasks.
        </p>
        <p className="sectionHint wentWellLogDateHint">Logging for {logDate}</p>

        {statements.length === 0 ? (
          <p className="sectionHint">All win statements were removed.</p>
        ) : (
          <ul className="proposedTasksList">
            {statements.map((statement) => {
              const general = isGeneral(statement.pillar_ids);
              return (
                <li key={statement.localId} className="card proposedTaskCard wentWellCard">
                  <div className="proposedTaskCardHead">
                    <span className="pill pillSubtle">Win</span>
                    <button
                      type="button"
                      className="rankBtn proposedTaskRemoveBtn"
                      onClick={() => removeStatement(statement.localId)}
                      disabled={saving}
                      aria-label={`Remove win statement`}
                    >
                      ×
                    </button>
                  </div>

                  <div className="modalField">
                    <label
                      className="modalLabel"
                      htmlFor={`went-well-content-${statement.localId}`}
                    >
                      Statement
                    </label>
                    <textarea
                      id={`went-well-content-${statement.localId}`}
                      className="chatInput"
                      rows={2}
                      value={statement.content}
                      onChange={(e) =>
                        updateStatement(statement.localId, { content: e.target.value })
                      }
                      disabled={saving}
                    />
                  </div>

                  <div className="modalField">
                    <span className="modalLabel">Pillars</span>
                    <div className="wentWellPillarToggles">
                      <button
                        type="button"
                        className={`outlineButton btnCompact wentWellPillarToggle ${general ? "wentWellPillarToggleActive" : ""}`}
                        onClick={() => setGeneral(statement.localId)}
                        disabled={saving}
                        aria-pressed={general}
                      >
                        General
                      </button>
                      {pillars.map((pillar) => {
                        const selected = statement.pillar_ids.includes(pillar.id);
                        return (
                          <button
                            key={pillar.id}
                            type="button"
                            className={`wentWellPillarToggle wentWellPillarChipToggle ${selected ? "wentWellPillarToggleActive" : ""}`}
                            onClick={() => togglePillar(statement.localId, pillar.id)}
                            disabled={saving}
                            aria-pressed={selected}
                          >
                            <PillarChip
                              name={pillar.name}
                              abbreviation={pillar.abbreviation}
                              color={pillar.color}
                              compact
                            />
                          </button>
                        );
                      })}
                    </div>
                    {!general && statement.pillar_ids.length > 0 && (
                      <p className="sectionHint wentWellPillarHint">
                        Tagged:{" "}
                        {statement.pillar_ids
                          .map((id) => pillars.find((p) => p.id === id)?.name)
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="modalActions">
          <button
            type="button"
            className="outlineButton"
            onClick={onDismiss}
            disabled={saving}
          >
            {statements.length === 0 ? "Close" : "Skip all"}
          </button>
          <button
            type="button"
            className="chatSendBtn"
            onClick={() =>
              onConfirm(statements.filter((s) => s.content.trim()))
            }
            disabled={saving || statements.every((s) => !s.content.trim())}
          >
            {saving
              ? "Saving..."
              : statements.length === 0
                ? "Done"
                : `Save ${statements.filter((s) => s.content.trim()).length} win${statements.filter((s) => s.content.trim()).length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
