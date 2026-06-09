"use client";

import { useCallback, useEffect, useState } from "react";
import PillarContextField from "./PillarContextField";

export default function UserPreferencesPanel() {
  const [preferences, setPreferences] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/preferences");
    const data = await res.json();
    if (data.ok) setPreferences(data.preferences ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function append(text: string) {
    const res = await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ append: text }),
    });
    const data = await res.json();
    if (data.ok) setPreferences(data.preferences ?? null);
  }

  async function removeEntry(index: number) {
    const res = await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remove_index: index }),
    });
    const data = await res.json();
    if (data.ok) setPreferences(data.preferences ?? null);
  }

  if (loading) {
    return <p className="sectionHint">Loading preferences...</p>;
  }

  return (
    <div className="userPreferencesPanel">
      <p className="sectionHint">
        Saved preferences and planning rules (e.g. no two runs on the same day). Mission
        Control reads these when processing your check-in.
      </p>
      <PillarContextField
        description={preferences}
        onAppend={append}
        onRemoveEntry={removeEntry}
        inputId="user-preferences"
      />
    </div>
  );
}
