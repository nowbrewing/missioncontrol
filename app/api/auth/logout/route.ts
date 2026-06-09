import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  deleteSession,
  SESSION_COOKIE,
} from "../../../../src/lib/auth";

export const POST = async () => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (token) await deleteSession(token);

    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Logout failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
};
