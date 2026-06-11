import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../src/lib/auth";
import { normalizePillarAbbreviationInput } from "../../../../src/lib/pillar-abbreviation";
import { isValidPillarColor, normalizePillarColor } from "../../../../src/lib/pillar-colors";
import {
  deletePillar,
  updatePillar,
} from "../../../../src/lib/mongodb/store/users";

type Params = { params: Promise<{ id: string }> };

export const PATCH = async (req: Request, { params }: Params) => {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const pillarId = Number(id);
    if (!Number.isFinite(pillarId)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const body = (await req.json()) as {
      name?: string;
      description?: string | null;
      abbreviation?: string | null;
      color?: string;
    };
    if (body.color !== undefined && !isValidPillarColor(body.color)) {
      return NextResponse.json({ ok: false, error: "Invalid color" }, { status: 400 });
    }

    const patch: Partial<{
      name: string;
      description: string | null;
      color: string;
      abbreviation: string | null;
    }> = {};

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
      }
      patch.name = name;
    }
    if (body.description !== undefined) {
      patch.description =
        typeof body.description === "string" ? body.description.trim() || null : null;
    }
    if (body.color !== undefined) {
      patch.color = normalizePillarColor(body.color);
    }
    if (body.abbreviation !== undefined) {
      patch.abbreviation = normalizePillarAbbreviationInput(String(body.abbreviation ?? ""));
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }

    await updatePillar(user.id, pillarId, patch);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Update failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};

export const DELETE = async (_req: Request, { params }: Params) => {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const pillarId = Number(id);
    if (!Number.isFinite(pillarId)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    await deletePillar(user.id, pillarId);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
