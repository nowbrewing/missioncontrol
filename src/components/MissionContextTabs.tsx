"use client";

import { useState } from "react";
import { PillarHeaderBar } from "./PillarChip";
import PillarChip from "./PillarChip";
import TaskDeadlineEditor from "./TaskDeadlineEditor";
import TaskPillarSelect from "./TaskPillarSelect";
import TaskTitleEditor from "./TaskTitleEditor";
import { formatRelativeDateLabel } from "../lib/mission-dates";
import { pillarColorVars } from "../lib/pillar-colors";
import type { MissionMilestone, MissionTask } from "../lib/mission-prioritize";

type Pillar = {
  id: number;
  name: string;
  color: string;
  rank: number;
};

import UserPreferencesPanel from "./UserPreferencesPanel";

type Tab = "pillars" | "milestones" | "chores" | "preferences";

export default function MissionContextTabs({
  pillars,
  milestones,
  tasks,
  onToggleTask,
  onDeadlineChange,
  onPillarChange,
  onTitleChange,
  onDeleteTask,
  today,
}: {
  pillars: Pillar[];
  milestones: MissionMilestone[];
  tasks: MissionTask[];
  onToggleTask: (id: number, completed: boolean) => void;
  onDeadlineChange: (id: number, deadline: string | null) => void;
  onPillarChange: (id: number, pillarId: number | null) => void;
  onTitleChange: (id: number, title: string) => void | Promise<void>;
  onDeleteTask: (id: number) => void;
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("pillars");
  const openTasks = tasks.filter((t) => !t.completed_at);
  const openMilestones = milestones.filter((m) => !m.completed_at);

  function renderTaskRow(task: MissionTask) {
    return (
      <li
        key={task.id}
        className={`taskRow ${task.pillar_color ? "taskRowColored" : ""}`}
        style={task.pillar_color ? pillarColorVars(task.pillar_color) : undefined}
      >
        <label className="taskCheck">
          <input
            type="checkbox"
            checked={!!task.completed_at}
            onChange={(e) => onToggleTask(task.id, e.target.checked)}
          />
        </label>
        <TaskTitleEditor
          title={task.title}
          completed={!!task.completed_at}
          onChange={(title) => onTitleChange(task.id, title)}
        />
        <TaskPillarSelect
          pillars={pillars}
          value={task.pillar_id}
          onChange={(pillarId) => onPillarChange(task.id, pillarId)}
          compact
        />
        {task.milestone_title && (
          <span className="pill pillSubtle">{task.milestone_title}</span>
        )}
        {task.deadline && (
          <span className="pill pillSubtle">
            {formatRelativeDateLabel(task.deadline, today)}
          </span>
        )}
        <TaskDeadlineEditor
          deadline={task.deadline}
          overdue={!!task.deadline && task.deadline < today && !task.completed_at}
          onChange={(deadline) => onDeadlineChange(task.id, deadline)}
        />
        <button
          type="button"
          className="rankBtn"
          onClick={() => {
            if (window.confirm(`Delete "${task.title}"? This cannot be undone.`)) {
              onDeleteTask(task.id);
            }
          }}
          aria-label={`Delete task: ${task.title}`}
        >
          ×
        </button>
        {task.completed_at && (
          <span className="pill pillSubtle">Done {task.completed_at.slice(0, 10)}</span>
        )}
      </li>
    );
  }

  return (
    <section className="section">
      <h2 className="sectionTitle">Your context</h2>

      <div className="missionTabs">
        <button
          type="button"
          className={`missionTab ${tab === "pillars" ? "missionTabActive" : ""}`}
          onClick={() => setTab("pillars")}
        >
          Pillars
        </button>
        <button
          type="button"
          className={`missionTab ${tab === "milestones" ? "missionTabActive" : ""}`}
          onClick={() => setTab("milestones")}
        >
          Milestones
        </button>
        <button
          type="button"
          className={`missionTab ${tab === "chores" ? "missionTabActive" : ""}`}
          onClick={() => setTab("chores")}
        >
          Chores
        </button>
        <button
          type="button"
          className={`missionTab ${tab === "preferences" ? "missionTabActive" : ""}`}
          onClick={() => setTab("preferences")}
        >
          Preferences
        </button>
      </div>

      {tab === "pillars" && (
        <div className="missionTabPanel">
          {pillars.length === 0 ? (
            <div className="card">
              <span style={{ opacity: 0.8 }}>Add pillars on the Pillars page first.</span>
            </div>
          ) : (
            pillars.map((pillar, idx) => {
              const pillarTasks = openTasks.filter((t) => t.pillar_id === pillar.id);
              return (
                <div
                  key={pillar.id}
                  className="missionPillarGroup taskPillarGroup"
                  style={pillarColorVars(pillar.color)}
                >
                  <PillarHeaderBar
                    name={pillar.name}
                    color={pillar.color}
                    rank={idx + 1}
                  />
                  {pillarTasks.length === 0 ? (
                    <p className="sectionHint">No open tasks for this pillar.</p>
                  ) : (
                    <ul className="taskList">{pillarTasks.map(renderTaskRow)}</ul>
                  )}
                </div>
              );
            })
          )}
          {openTasks.filter((t) => !t.pillar_id).length > 0 && (
            <div className="missionPillarGroup">
              <h3 className="sectionTitle">Unassigned</h3>
              <ul className="taskList">
                {openTasks.filter((t) => !t.pillar_id).map(renderTaskRow)}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "milestones" && (
        <div className="missionTabPanel">
          {openMilestones.length === 0 ? (
            <div className="card">
              <span style={{ opacity: 0.8 }}>No open milestones yet.</span>
            </div>
          ) : (
            openMilestones.map((milestone) => {
              const linked = openTasks.filter((t) => t.milestone_id === milestone.id);
              return (
                <div
                  key={milestone.id}
                  className={`missionMilestoneGroup ${milestone.pillar_color ? "taskRowColored" : ""}`}
                  style={
                    milestone.pillar_color
                      ? pillarColorVars(milestone.pillar_color)
                      : undefined
                  }
                >
                  <div className="missionMilestoneHeader">
                    <strong>{milestone.title}</strong>
                    {milestone.pillar_name && (
                      <PillarChip
                        name={milestone.pillar_name}
                        abbreviation={milestone.pillar_abbreviation}
                        color={milestone.pillar_color}
                        compact
                      />
                    )}
                    {milestone.target_date && (
                      <span className="pill pillSubtle">{milestone.target_date}</span>
                    )}
                  </div>
                  {linked.length > 0 ? (
                    <ul className="taskList">{linked.map(renderTaskRow)}</ul>
                  ) : (
                    <p className="sectionHint">No tasks linked yet.</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "chores" && (
        <div className="missionTabPanel">
          {openTasks.length === 0 ? (
            <div className="card">
              <span style={{ opacity: 0.8 }}>No open chores or tasks.</span>
            </div>
          ) : (
            <ul className="taskList">{openTasks.map(renderTaskRow)}</ul>
          )}
        </div>
      )}

      {tab === "preferences" && (
        <div className="missionTabPanel">
          <UserPreferencesPanel />
        </div>
      )}
    </section>
  );
}
