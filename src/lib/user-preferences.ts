import { todayIsoYyyyMmDd } from "./date";
import {
  appendPillarContext,
  formatPillarContextForPrompt,
  parsePillarContext,
  removePillarContextAt,
  serializePillarContext,
  type PillarContextEntry,
} from "./pillar-context";

export type UserPreferenceEntry = PillarContextEntry;

export const parseUserPreferences = parsePillarContext;
export const serializeUserPreferences = serializePillarContext;
export const formatUserPreferencesForPrompt = formatPillarContextForPrompt;

export function appendUserPreference(
  preferences: string | null | undefined,
  text: string,
  at = todayIsoYyyyMmDd()
): string | null {
  return appendPillarContext(preferences, text, at);
}

export function removeUserPreferenceAt(
  preferences: string | null | undefined,
  index: number
): string | null {
  return removePillarContextAt(preferences, index);
}
