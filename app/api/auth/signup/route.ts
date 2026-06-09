import { NextResponse } from "next/server";
import { ensureUsersSchema } from "../../../../src/db/users";
import {
  createSession,
  hashPassword,
  isValidEmail,
  setSessionCookie,
} from "../../../../src/lib/auth";
import { requireTursoClient } from "../../../../src/lib/turso";

export const POST = async (req: Request) => {
  try {
    const body = (await req.json()) as {
      email?: string;
      name?: string;
      password?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();
    const password = body.password;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }
    if (!name || name.length < 1) {
      return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const turso = requireTursoClient();
    await ensureUsersSchema(turso);

    const existing = await turso.execute({
      sql: `SELECT id FROM users WHERE email = ? LIMIT 1;`,
      args: [email],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { ok: false, error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const result = await turso.execute({
      sql: `INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?) RETURNING id;`,
      args: [email, name, hashPassword(password)],
    });
    const userId = Number((result.rows[0] as Record<string, unknown>).id);

    const token = await createSession(userId);
    const res = NextResponse.json({
      ok: true,
      user: { id: userId, email, name },
    });
    setSessionCookie(res, token);
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Signup failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
};
