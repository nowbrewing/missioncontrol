import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../src/lib/auth";
import { listMilestones } from "../../../../src/lib/mongodb/store/milestones";
import { listTasks } from "../../../../src/lib/mongodb/store/tasks";
import { listPillars } from "../../../../src/lib/mongodb/store/users";

export async function GET() {
  try {
    const user = await requireSessionUser();

    const [pillars, milestones, tasks] = await Promise.all([
      listPillars(user.id),
      listMilestones(user.id),
      listTasks(user.id),
    ]);

    return NextResponse.json({
      ok: true,
      pillars: pillars.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        rank: p.rank,
      })),
      milestones: milestones
        .filter((m) => !m.completed_at)
        .map((m) => ({
          id: m.id,
          title: m.title,
          pillar_id: m.pillar_id,
          target_date: m.target_date,
        })),
      tasks: tasks
        .filter((t) => !t.completed_at)
        .map((t) => ({
          id: t.id,
          title: t.title,
          pillar_id: t.pillar_id,
          deadline: t.deadline,
        })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Load failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
