import { NextResponse } from "next/server";
import { ensureUsersSchema } from "../../../src/db/users";
import {
  appendUserPreference,
  removeUserPreferenceAt,
} from "../../../src/lib/user-preferences";
import { requireSessionUser } from "../../../src/lib/auth";
import { requireTursoClient } from "../../../src/lib/turso";

export const GET = async () => {
  try {
    const user = await requireSessionUser();
    const turso = requireTursoClient();
    await ensureUsersSchema(turso);

    const result = await turso.execute({
      sql: `SELECT preferences FROM users WHERE id = ?;`,
      args: [user.id],
    });
    const row = result.rows[0] as Record<string, unknown> | undefined;

    return NextResponse.json({
      ok: true,
      preferences: (row?.preferences as string | null) ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Load failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};

export const PATCH = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as {
      append?: string;
      remove_index?: number;
    };

    const turso = requireTursoClient();
    await ensureUsersSchema(turso);

    const current = await turso.execute({
      sql: `SELECT preferences FROM users WHERE id = ?;`,
      args: [user.id],
    });
    const row = current.rows[0] as Record<string, unknown> | undefined;
    const existing = (row?.preferences as string | null) ?? null;

    let next: string | null = existing;
    if (typeof body.append === "string" && body.append.trim()) {
      next = appendUserPreference(existing, body.append);
    } else if (typeof body.remove_index === "number") {
      next = removeUserPreferenceAt(existing, body.remove_index);
    } else {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }

    await turso.execute({
      sql: `UPDATE users SET preferences = ? WHERE id = ?;`,
      args: [next, user.id],
    });

    return NextResponse.json({ ok: true, preferences: next });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Update failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
