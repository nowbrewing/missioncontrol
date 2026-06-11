import { NextResponse } from "next/server";
import {
  createSession,
  hashPassword,
  isValidEmail,
  setSessionCookie,
} from "../../../../src/lib/auth";
import { createUser, findUserByEmail } from "../../../../src/lib/mongodb/store/users";

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

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const user = await createUser(email, name, hashPassword(password));
    const token = await createSession(user.id);
    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email, name },
    });
    setSessionCookie(res, token);
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Signup failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
};
