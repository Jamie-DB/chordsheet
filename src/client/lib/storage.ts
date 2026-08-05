import type { Song } from "../../shared/types";
import { songSchema } from "../../shared/schemas";

const KEY = "chordsheet.songs.v1";

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

export function slugify(title: string, taken: Set<string>): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "song";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Split pasted lyrics into lines: tabs to spaces, trailing whitespace trimmed. */
export function lyricsFromPaste(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\t/g, "    ").replace(/\s+$/g, ""));
}
