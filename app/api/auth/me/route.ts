import { NextResponse } from "next/server";
import { getSessionUser } from "../../../../src/lib/auth";

export const GET = async () => {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, user });
};
