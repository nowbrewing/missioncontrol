import { NextResponse } from "next/server";
import { ensureAdkApiKey, runAdkHealthCheck } from "../../../../src/lib/adk/run-brain-dump";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/brain-dump/health — verify Google ADK Life Agent connectivity. */
export async function GET() {
  const model = "gemini-2.5-flash";

  try {
    ensureAdkApiKey();
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        model,
        error: e instanceof Error ? e.message : "Not configured",
      },
      { status: 500 }
    );
  }

  try {
    const sample = await runAdkHealthCheck();
    return NextResponse.json({
      ok: true,
      model,
      sample,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        model,
        error: e instanceof Error ? e.message : "ADK health check failed",
        raw: e instanceof Error ? e.message : String(e),
      },
      { status: 502 }
    );
  }
}
