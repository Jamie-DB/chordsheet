import type { Setlist, Song } from "../../shared/types";
import { setlistSchema, songSchema } from "../../shared/schemas";

const KEY = "chordsheet.songs.v1";
const SETS_KEY = "chordsheet.setlists.v1";

export function loadLibrary(): Song[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const songs: Song[] = [];
    for (const item of parsed) {
      const result = songSchema.safeParse(item);
      if (result.success) songs.push(result.data);
      else console.warn("chordsheet: skipping invalid stored song", result.error);
    }
    return songs;
  } catch (err) {
    console.warn("chordsheet: could not read library", err);
    return [];
  }
}

export function saveLibrary(songs: Song[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(songs));
  } catch (err) {
    console.warn("chordsheet: could not save library", err);
  }
}

export function loadSetlists(): Setlist[] {
  try {
    const raw = localStorage.getItem(SETS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const sets: Setlist[] = [];
    for (const item of parsed) {
      const result = setlistSchema.safeParse(item);
      if (result.success) sets.push(result.data);
      else console.warn("chordsheet: skipping invalid stored setlist", result.error);
    }
    return sets;
  } catch (err) {
    console.warn("chordsheet: could not read setlists", err);
    return [];
  }
}

export function saveSetlists(sets: Setlist[]): void {
  try {
    localStorage.setItem(SETS_KEY, JSON.stringify(sets));
  } catch (err) {
    console.warn("chordsheet: could not save setlists", err);
  }
}

export { slugify } from "../../shared/slug";

const UI_KEY = "chordsheet.ui.v1";

export function loadUiPrefs(): { sort?: string } {
  try {
    return JSON.parse(localStorage.getItem(UI_KEY) ?? "{}") as { sort?: string };
  } catch {
    return {};
  }
}

export function saveUiPrefs(prefs: { sort?: string }): void {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(prefs));
  } catch {
    // Preference only; losing it is harmless.
  }
}

/** Split pasted lyrics into lines: tabs to spaces, trailing whitespace trimmed. */
export function lyricsFromPaste(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\t/g, "    ").replace(/\s+$/g, ""));
}
