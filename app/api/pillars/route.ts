import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../src/lib/auth";
import { normalizePillarAbbreviationInput } from "../../../src/lib/pillar-abbreviation";
import { isValidPillarColor, normalizePillarColor } from "../../../src/lib/pillar-colors";
import {
  getMaxPillarRank,
  insertPillar,
  listPillars,
} from "../../../src/lib/mongodb/store/users";
import { listGoals } from "../../../src/lib/mongodb/store/goals";
import { listMilestones } from "../../../src/lib/mongodb/store/milestones";

export const GET = async () => {
  try {
    const user = await requireSessionUser();
    const [pillars, goals, milestones] = await Promise.all([
      listPillars(user.id),
      listGoals(user.id),
      listMilestones(user.id),
    ]);

    return NextResponse.json({
      ok: true,
      pillars,
      goals,
      milestones,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load pillars";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};

export const POST = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as {
      name?: string;
      description?: string;
      abbreviation?: string | null;
      color?: string;
    };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
    }
    const color = body.color?.trim();
    if (color && !isValidPillarColor(color)) {
      return NextResponse.json({ ok: false, error: "Invalid color" }, { status: 400 });
    }

    const rank = (await getMaxPillarRank(user.id)) + 1;

    const abbreviation =
      body.abbreviation !== undefined
        ? normalizePillarAbbreviationInput(String(body.abbreviation ?? ""))
        : null;

    const pillar = await insertPillar(user.id, {
      name,
      description: body.description?.trim() || null,
      abbreviation,
      color: normalizePillarColor(color),
      rank,
    });

    return NextResponse.json({ ok: true, pillar });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create pillar";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
