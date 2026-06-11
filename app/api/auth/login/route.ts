import { NextResponse } from "next/server";
import {
  createSession,
  isValidEmail,
  setSessionCookie,
  verifyPassword,
} from "../../../../src/lib/auth";
import { findUserWithPassword } from "../../../../src/lib/mongodb/store/users";

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

    const user = await findUserWithPassword(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = await createSession(user.tursoId);
    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.tursoId,
        email: user.email,
        name: user.name,
      },
    });
    setSessionCookie(res, token);
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Login failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
};
