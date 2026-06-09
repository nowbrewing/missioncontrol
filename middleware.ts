import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/pillars",
  "/daily",
  "/tasks",
  "/mission",
  "/scheduling",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!isProtected) return NextResponse.next();

  const session = req.cookies.get("mc_session")?.value;
  if (!session) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/pillars/:path*",
    "/daily/:path*",
    "/tasks/:path*",
    "/mission/:path*",
    "/scheduling/:path*",
  ],
};
