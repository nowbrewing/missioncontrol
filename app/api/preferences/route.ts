import { NextResponse } from "next/server";
import {
  appendUserPreference,
  removeUserPreferenceAt,
} from "../../../src/lib/user-preferences";
import { requireSessionUser } from "../../../src/lib/auth";
import {
  getUserPreferences,
  setUserPreferences,
} from "../../../src/lib/mongodb/store/users";

export const GET = async () => {
  try {
    const user = await requireSessionUser();
    const preferences = await getUserPreferences(user.id);

    return NextResponse.json({
      ok: true,
      preferences,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Load failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};

export const PATCH = async (req: Request) => {
  try {
    const user = await requireSessionUser();
    const body = (await req.json()) as {
      append?: string;
      remove_index?: number;
    };

    const existing = await getUserPreferences(user.id);

    let next: string | null = existing;
    if (typeof body.append === "string" && body.append.trim()) {
      next = appendUserPreference(existing, body.append);
    } else if (typeof body.remove_index === "number") {
      next = removeUserPreferenceAt(existing, body.remove_index);
    } else {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }

    await setUserPreferences(user.id, next);

    return NextResponse.json({ ok: true, preferences: next });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Update failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
};
