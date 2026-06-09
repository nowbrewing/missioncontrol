"use client";

import { useCallback, useEffect, useState } from "react";
import MissionContextTabs from "./MissionContextTabs";
import type { MissionMilestone, MissionTask } from "../lib/mission-prioritize";

type BriefSlice = {
  today: string;
  pillars: {
    id: number;
    name: string;
    abbreviation?: string | null;
    color: string;
    rank: number;
  }[];
  milestones: MissionMilestone[];
  tasks: MissionTask[];
};

export default function PillarsContextSection() {
  const [brief, setBrief] = useState<BriefSlice | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBrief = useCallback(async () => {
    const res = await fetch("/api/mission/brief");
    const data = await res.json();
    if (data.ok) {
      setBrief({
        today: data.today,
        pillars: data.pillars,
        milestones: data.milestones,
        tasks: data.tasks,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBrief();
  }, [loadBrief]);

  async function toggleTask(id: number, completed: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    await loadBrief();
  }

  async function updateTaskDeadline(id: number, deadline: string | null) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deadline }),
    });
    await loadBrief();
  }

  async function updateTaskPillar(id: number, pillarId: number | null) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pillar_id: pillarId }),
    });
    await loadBrief();
  }

  async function patchTask(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Could not save task");
    }
  }

  async function updateTaskTitle(id: number, title: string) {
    setBrief((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === id ? { ...t, title } : t)),
          }
        : prev
    );
    try {
      await patchTask(id, { title });
    } catch {
      await loadBrief();
      throw new Error("Could not save task title");
    }
  }

  async function deleteTask(id: number) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await loadBrief();
  }

  if (loading && !brief) {
    return <p className="sectionHint">Loading context...</p>;
  }

  if (!brief) return null;

  return (
    <MissionContextTabs
      pillars={brief.pillars}
      milestones={brief.milestones}
      tasks={brief.tasks}
      today={brief.today}
      onToggleTask={toggleTask}
      onDeadlineChange={updateTaskDeadline}
      onPillarChange={updateTaskPillar}
      onTitleChange={updateTaskTitle}
      onDeleteTask={deleteTask}
    />
  );
}
