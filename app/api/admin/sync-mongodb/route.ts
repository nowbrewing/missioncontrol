import { NextResponse } from "next/server";

function isAuthorized(request: Request): boolean {
  const token = process.env.ADMIN_INIT_TOKEN?.trim();
  if (!token) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  return header === `Bearer ${token}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Deprecated: Turso-to-Mongo sync route is no longer available.",
    },
    { status: 410 }
  );
}
