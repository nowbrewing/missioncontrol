"use client";

import { useCallback, useEffect, useState } from "react";
import RecurringEventsSetup from "./RecurringEventsSetup";

type Pillar = {
  id: number;
  name: string;
  abbreviation?: string | null;
  color: string;
};

type Milestone = {
  id: number;
  title: string;
  pillar_id: number | null;
};

export default function SchedulingSetup() {
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/pillars");
    const data = await res.json();
    if (data.ok) {
      setPillars(data.pillars);
      setMilestones(data.milestones);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="sectionHint">Loading scheduling...</p>;
  }

  return <RecurringEventsSetup pillars={pillars} milestones={milestones} />;
}
