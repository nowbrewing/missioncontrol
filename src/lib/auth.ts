import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureMongoReady } from "./mongodb/init";
import {
  createSession as createMongoSession,
  deleteSession as deleteMongoSession,
  getSessionUser as getMongoSessionUser,
  type UserRow,
} from "./mongodb/store";

export type { UserRow };

export const SESSION_COOKIE = "mr_session";
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

function sessionExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_DAYS);
  return d;
}

export async function createSession(userId: number): Promise<string> {
  await ensureMongoReady();
  const token = generateSessionToken();
  await createMongoSession(userId, token, sessionExpiresAt());
  return token;
}

export async function deleteSession(token: string) {
  await ensureMongoReady();
  await deleteMongoSession(token);
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

  await ensureMongoReady();
  return getMongoSessionUser(token);
}

export async function requireSessionUser(): Promise<UserRow> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
