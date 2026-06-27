"use client";

import type { ProposedCorrection } from "../../lib/adk/propose-corrections";

export default function CorrectionReviewModal({
  corrections,
  saving,
  saveError,
  onConfirm,
  onDismiss,
}: {
  corrections: ProposedCorrection[];
  saving: boolean;
  saveError: string | null;
  onConfirm: (corrections: ProposedCorrection[]) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="modalBackdrop" role="presentation" onClick={() => !saving && onDismiss()}>
      <div
        className="modal thinkpadSaveModal correctionReviewModal"
        role="dialog"
        aria-labelledby="correction-review-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="correction-review-title" className="modalTitle">
          Apply corrections
        </h2>
        <p className="modalHint">
          These records will be updated in place so future context stays accurate.
        </p>

        <ul className="correctionReviewList">
          {corrections.map((row) => (
            <li key={row.record_id} className="correctionReviewItem">
              <p className="correctionReviewMeta">{row.record_id}</p>
              {row.reason && <p className="correctionReviewReason">{row.reason}</p>}
              <div className="correctionReviewDiff">
                <div>
                  <span className="correctionReviewLabel">Before</span>
                  <p>{row.before || "—"}</p>
                </div>
                <div>
                  <span className="correctionReviewLabel">After</span>
                  <p>{row.after}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {saveError && <p className="chatError">{saveError}</p>}

        <div className="modalActions">
          <button type="button" className="outlineButton" onClick={onDismiss} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="chatSendBtn"
            onClick={() => onConfirm(corrections)}
            disabled={saving}
          >
            {saving ? "Saving…" : `Update ${corrections.length} record${corrections.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
