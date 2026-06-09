import { NextResponse } from "next/server";
import { ensureLifeSchema } from "../../../../src/db/life";
import { ensureUsersSchema } from "../../../../src/db/users";
import { requireTursoClient } from "../../../../src/lib/turso";

function requireAdminToken(req: Request) {
  const expected = process.env.ADMIN_INIT_TOKEN;
  if (!expected) return;
  const got = req.headers.get("x-admin-token");
  if (got !== expected) throw new Error("Unauthorized");
}

export const POST = async (req: Request) => {
  try {
    requireAdminToken(req);
    const turso = requireTursoClient();

    await ensureUsersSchema(turso);
    await ensureLifeSchema(turso);

    return NextResponse.json({
      ok: true,
      users_ready: true,
      life_app_ready: true,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Init failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
