import { NextResponse } from "next/server";
import { ensureUsersSchema } from "../../../../src/db/users";
import {
  createSession,
  isValidEmail,
  setSessionCookie,
  verifyPassword,
} from "../../../../src/lib/auth";
import { requireTursoClient } from "../../../../src/lib/turso";

export const POST = async (req: Request) => {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !isValidEmail(email) || !password) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password" },
        { status: 400 }
      );
    }

    const turso = requireTursoClient();
    await ensureUsersSchema(turso);

    const result = await turso.execute({
      sql: `SELECT id, email, name, password_hash FROM users WHERE email = ? LIMIT 1;`,
      args: [email],
    });
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row || !verifyPassword(password, String(row.password_hash))) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = await createSession(Number(row.id));
    const res = NextResponse.json({
      ok: true,
      user: {
        id: Number(row.id),
        email: String(row.email),
        name: String(row.name),
      },
    });
    setSessionCookie(res, token);
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Login failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
};
