"use client";

import { useCallback, useEffect, useState } from "react";
import DailyLogForm from "../DailyLogForm";
import PillarsSetup from "../PillarsSetup";

type Section = "pillars" | "history";

export default function SettingsSections({ onboarding = false }: { onboarding?: boolean }) {
  const [section, setSection] = useState<Section>("pillars");

  const syncFromHash = useCallback(() => {
    if (typeof window === "undefined") return;
    setSection(window.location.hash === "#history" ? "history" : "pillars");
  }, []);

  useEffect(() => {
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [syncFromHash]);

  function selectSection(next: Section) {
    setSection(next);
    const url = next === "history" ? "/settings#history" : "/settings";
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="settingsSections">
      {!onboarding && (
        <div className="settingsTabs" role="tablist" aria-label="Settings sections">
          <button
            type="button"
            role="tab"
            id="settings-tab-pillars"
            aria-selected={section === "pillars"}
            aria-controls="settings-panel-pillars"
            className={`settingsTab ${section === "pillars" ? "settingsTabActive" : ""}`}
            onClick={() => selectSection("pillars")}
          >
            Pillars
          </button>
          <button
            type="button"
            role="tab"
            id="settings-tab-history"
            aria-selected={section === "history"}
            aria-controls="settings-panel-history"
            className={`settingsTab ${section === "history" ? "settingsTabActive" : ""}`}
            onClick={() => selectSection("history")}
          >
            History
          </button>
        </div>
      )}

      {(section === "pillars" || onboarding) && (
        <section
          id="settings-panel-pillars"
          role="tabpanel"
          aria-labelledby="settings-tab-pillars"
          className="settingsPanel"
        >
          {!onboarding && (
            <>
              <h2 className="settingsPanelTitle">Pillars</h2>
              <p className="sectionHint settingsPanelHint">
                Define your life focus areas and attach milestones with optional deadlines.
              </p>
            </>
          )}
          <PillarsSetup onboarding={onboarding} />
        </section>
      )}

      {section === "history" && !onboarding && (
        <section
          id="settings-panel-history"
          role="tabpanel"
          aria-labelledby="settings-tab-history"
          className="settingsPanel"
        >
          <h2 className="settingsPanelTitle">History</h2>
          <p className="sectionHint settingsPanelHint">
            Past check-ins, wins, brain dumps, and assistant notes — browse and edit by date.
          </p>
          <DailyLogForm />
        </section>
      )}
    </div>
  );
}
