import { NextResponse } from "next/server";
import { applyCorrections } from "../../../../src/lib/apply-corrections";
import type { ProposedCorrection } from "../../../../src/lib/adk/propose-corrections";
import { requireSessionUser } from "../../../../src/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();

    const body = (await req.json()) as {
      corrections?: ProposedCorrection[];
    };

    const corrections = (body.corrections ?? []).filter(
      (c) =>
        c &&
        typeof c.record_id === "string" &&
        typeof c.after === "string" &&
        c.record_id.trim() &&
        c.after.trim()
    );

    if (corrections.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No corrections to apply" },
        { status: 400 }
      );
    }

    const applied = await applyCorrections(user.id, corrections);

    return NextResponse.json({
      ok: true,
      applied,
      saved: applied.filter((a) => a.ok).length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Apply failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    console.error("[correction/apply]", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
