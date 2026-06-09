"use client";

import { useCallback, useEffect, useState } from "react";
import PillarChip from "./PillarChip";

type Pillar = {
  id: number;
  name: string;
  color: string;
  rank: number;
};

export default function PillarOverview() {
  const [pillars, setPillars] = useState<Pillar[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/pillars");
    const data = await res.json();
    if (data.ok) setPillars(data.pillars);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (pillars.length === 0) return null;

  return (
    <div className="pillarOverview">
      <span className="modalLabel">Your pillars</span>
      <div className="pillarOverviewList">
        {pillars.map((pillar, idx) => (
          <PillarChip
            key={pillar.id}
            name={pillar.name}
            color={pillar.color}
            rank={idx + 1}
          />
        ))}
      </div>
    </div>
  );
}
