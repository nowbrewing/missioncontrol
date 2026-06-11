"use client";

import type { LifeAdminStats } from "../lib/life-admin";

export default function MissionLifeAdminStats({
  stats,
}: {
  stats: LifeAdminStats | null;
}) {
  if (!stats) return null;
  if (stats.openCount === 0 && stats.completedThisWeek === 0) {
    return null;
  }

  return (
    <div className="lifeAdminStats" aria-label="Life admin">
      <div className="lifeAdminStatsRow">
        <span className="lifeAdminStatsLabel">Life admin</span>
        <span className="lifeAdminStatsItem">
          <strong>{stats.openCount}</strong> open
        </span>
        <span className="lifeAdminStatsItem">
          <strong>{stats.completedThisWeek}</strong> completed this week
        </span>
      </div>
    </div>
  );
}
