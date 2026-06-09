import { NextResponse } from "next/server";
import { ensureLifeSchema } from "../../../../src/db/life";
import { requireSessionUser } from "../../../../src/lib/auth";
import { reorderItems } from "../../../../src/lib/reorder";
import { requireTursoClient } from "../../../../src/lib/turso";

export const POST = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as { ids?: number[] };
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ ok: false, error: "Invalid ids" }, { status: 400 });
    }

    const turso = requireTursoClient();
    await ensureLifeSchema(turso);
    await reorderItems(turso, "milestones", user.id, body.ids);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Reorder failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
