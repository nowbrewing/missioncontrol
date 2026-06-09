import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureUsersSchema, type UserRow } from "../db/users";
import { requireTursoClient } from "./turso";

export const SESSION_COOKIE = "mc_session";
const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const testHash = scryptSync(password, salt, 64);
  if (hashBuffer.length !== testHash.length) return false;
  return timingSafeEqual(hashBuffer, testHash);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

function sessionExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_DAYS);
  return d.toISOString();
}

export async function createSession(userId: number): Promise<string> {
  const turso = requireTursoClient();
  await ensureUsersSchema(turso);
  const token = generateSessionToken();
  await turso.execute({
    sql: `INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?);`,
    args: [userId, token, sessionExpiresAt()],
  });
  return token;
}

export async function deleteSession(token: string) {
  const turso = requireTursoClient();
  await turso.execute({
    sql: `DELETE FROM sessions WHERE token = ?;`,
    args: [token],
  });
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionUser(): Promise<UserRow | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const turso = requireTursoClient();
  await ensureUsersSchema(turso);

  const result = await turso.execute({
    sql: `SELECT u.id, u.email, u.name, u.created_at
          FROM sessions s
          JOIN users u ON u.id = s.user_id
          WHERE s.token = ? AND s.expires_at > datetime('now')
          LIMIT 1;`,
    args: [token],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    id: Number(row.id),
    email: String(row.email),
    name: String(row.name),
    created_at: String(row.created_at),
  };
}

export async function requireSessionUser(): Promise<UserRow> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
