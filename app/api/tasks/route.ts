import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../src/lib/auth";
import { isYyyyMmDd } from "../../../src/lib/date";
import {
  getMaxIdeaRankForPillar,
  getMaxTaskRank,
  insertTask,
  listTasks,
} from "../../../src/lib/mongodb/store/tasks";

export const GET = async () => {
  try {
    const user = await requireSessionUser();
    const tasks = await listTasks(user.id);
    return NextResponse.json({ ok: true, tasks });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load tasks";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};

export const POST = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as {
      title?: string;
      description?: string;
      note?: string;
      deadline?: string | null;
      pillar_id?: number | null;
      milestone_id?: number | null;
      is_idea?: boolean;
    };

    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
    }
    const isIdea = !!body.is_idea;
    if (isIdea && body.deadline) {
      return NextResponse.json(
        { ok: false, error: "Ideas cannot have a deadline — add a date later to schedule" },
        { status: 400 }
      );
    }
    if (body.deadline && !isYyyyMmDd(body.deadline)) {
      return NextResponse.json({ ok: false, error: "Invalid deadline" }, { status: 400 });
    }

    const rank = isIdea
      ? (await getMaxIdeaRankForPillar(user.id, body.pillar_id ?? null)) + 1
      : (await getMaxTaskRank(user.id)) + 1;
    const task = await insertTask(user.id, {
      title,
      description: body.description?.trim() || null,
      note: body.note?.trim() || null,
      deadline: body.deadline ?? null,
      rank,
      pillarId: body.pillar_id ?? null,
      milestoneId: body.milestone_id ?? null,
      isIdea,
    });

    return NextResponse.json({ ok: true, task });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create task";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
