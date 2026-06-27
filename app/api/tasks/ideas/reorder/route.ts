import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../../src/lib/auth";
import { reorderIdeas } from "../../../../../src/lib/mongodb/store/tasks";

export const POST = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as { pillar_id?: number; ids?: number[] };
    if (typeof body.pillar_id !== "number" || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
    }

    await reorderIdeas(user.id, body.pillar_id, body.ids);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Reorder failed";
    const status = msg === "Unauthorized" ? 401 : msg === "Invalid idea ids" ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
