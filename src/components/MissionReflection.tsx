"use client";

import type { MissionReflectionDisplay } from "../lib/mission-reflection-display";

export default function MissionReflection({
  reflection,
}: {
  reflection: MissionReflectionDisplay | null;
  today: string;
}) {
  if (!reflection) return null;

  const kickoff = reflection.kickoff || reflection.reflection.split("\n\n")[0] || "";
  const restOfDay =
    reflection.rest_of_day ||
    reflection.reflection.split("\n\n").slice(1).join("\n\n") ||
    "";

  if (!kickoff && !restOfDay && reflection.flags.length === 0) return null;

  return (
    <div className="card missionReflection">
      {kickoff && (
        <div className="missionReflectionSection">
          <h3 className="missionReflectionSectionTitle">Kick off</h3>
          <p className="missionReflectionText">{kickoff}</p>
        </div>
      )}

      {restOfDay && (
        <div className="missionReflectionSection">
          <h3 className="missionReflectionSectionTitle">Rest of day</h3>
          <p className="missionReflectionText">{restOfDay}</p>
        </div>
      )}

      {reflection.flags.length > 0 && (
        <div className="missionReflectionFlags">
          <ul className="missionReflectionFlagList">
            {reflection.flags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
