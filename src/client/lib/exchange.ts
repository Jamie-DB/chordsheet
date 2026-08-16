import { resolveAnchor } from "../../engine";
import { importedSongSchema, setlistSchema, songSchema } from "../../shared/schemas";
import type { ChordPlacement, Setlist, Song } from "../../shared/types";
import { normalizeSections } from "./normalize";

export interface UnresolvedPlacement {
  line: number;
  chord: string;
  anchor: string;
  reason: string;
}

export interface ImportSuccess {
  ok: true;
  song: Song;
  unresolved: UnresolvedPlacement[];
  /** True when the imported JSON tried to change lyrics of an existing song; the change was rejected. */
  lyricsRejected: boolean;
}

export interface ImportFailure {
  ok: false;
  error: string;
}

export type ImportResult = ImportSuccess | ImportFailure;

function freshId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `p-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Parse imported song JSON. Only the placements array is ever accepted from
 * outside for an existing song; lyric or metadata changes are rejected in
 * favor of what the library already holds. Anchor-form placements resolve to
 * columns here; failures are reported, never silently dropped.
 */
export function parseImport(jsonText: string, existing?: Song): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "Not valid JSON. Copy the complete file or reply, including the outer braces." };
  }

  const result = importedSongSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first.path.length > 0 ? ` at ${first.path.join(".")}` : "";
    return { ok: false, error: `Song JSON failed validation${where}: ${first.message}` };
  }
  const imported = result.data;

  // For an existing song, everything but placements comes from the library copy.
  const base: Song = existing ?? {
    version: 1,
    id: imported.id,
    title: imported.title,
    artist: imported.artist,
    lyrics: imported.lyrics,
    placements: [],
    keyOverride: imported.keyOverride,
    capo: imported.capo,
    bpm: imported.bpm,
    notes: imported.notes,
    createdAt: imported.createdAt,
    updatedAt: imported.updatedAt,
  };
  const lyricsRejected =
    existing !== undefined &&
    JSON.stringify(imported.lyrics) !== JSON.stringify(existing.lyrics);

  const placements: ChordPlacement[] = [];
  const unresolved: UnresolvedPlacement[] = [];
  for (const p of imported.placements) {
    if (p.line < 0 || p.line >= base.lyrics.length) {
      unresolved.push({
        line: p.line,
        chord: p.chord,
        anchor: "anchor" in p ? p.anchor : "",
        reason: `line ${p.line} does not exist`,
      });
      continue;
    }
    const lineText = base.lyrics[p.line];
    if ("col" in p) {
      // Past-end columns are legitimate (between-phrase progressions);
      // only an absurd value gets bounded.
      placements.push({
        id: p.id ?? freshId(),
        line: p.line,
        col: Math.max(0, Math.min(200, p.col)),
        chord: p.chord,
        ...(p.hold ? { hold: true } : {}),
      });
    } else {
      const col = resolveAnchor(lineText, p.anchor, p.anchorOccurrence ?? 1, p.offsetInAnchor ?? 0);
      if (col === null) {
        unresolved.push({
          line: p.line,
          chord: p.chord,
          anchor: p.anchor,
          reason: `anchor "${p.anchor}" not found in line ${p.line}`,
        });
      } else {
        placements.push({
          id: freshId(),
          line: p.line,
          col,
          chord: p.chord,
          ...(p.hold ? { hold: true } : {}),
        });
      }
    }
  }

  // New songs get section spacing normalized on the way in; existing songs
  // keep their library lyrics, which the load-time migration already fixed.
  const normalized = existing ? { lyrics: base.lyrics, placements } : normalizeSections(base.lyrics, placements);
  return {
    ok: true,
    song: { ...base, lyrics: normalized.lyrics, placements: normalized.placements },
    unresolved,
    lyricsRejected,
  };
}

export function songToJson(song: Song): string {
  return JSON.stringify(song, null, 2) + "\n";
}

export function libraryToJson(songs: Song[], setlists: Setlist[] = []): string {
  return JSON.stringify({ chordsheetLibrary: 1, songs, setlists }, null, 2) + "\n";
}

export function setlistsToJson(setlists: Setlist[]): string {
  return JSON.stringify({ chordsheetSetlists: 1, setlists }, null, 2) + "\n";
}

export interface LibraryImport {
  songs: Song[];
  setlists: Setlist[];
  /** Entries that failed schema validation and were left out. */
  invalid: number;
}

/**
 * Recognize a whole-library backup file. Returns null when the text is not
 * one (single-song import handles it instead); invalid entries are counted,
 * never silently absorbed.
 */
export function parseLibraryFile(jsonText: string): LibraryImport | null {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (
    typeof raw !== "object" ||
    raw === null ||
    (raw as { chordsheetLibrary?: unknown }).chordsheetLibrary !== 1 ||
    !Array.isArray((raw as { songs?: unknown }).songs)
  ) {
    return null;
  }
  const songs: Song[] = [];
  let invalid = 0;
  for (const item of (raw as { songs: unknown[] }).songs) {
    const result = songSchema.safeParse(item);
    if (result.success) songs.push(result.data);
    else invalid += 1;
  }
  // Older backups have no setlists field; that is fine.
  const setlists: Setlist[] = [];
  const rawSets = (raw as { setlists?: unknown }).setlists;
  if (Array.isArray(rawSets)) {
    for (const item of rawSets) {
      const result = setlistSchema.safeParse(item);
      if (result.success) setlists.push(result.data);
      else invalid += 1;
    }
  }
  return { songs, setlists, invalid };
}

/** Browser-only: download the whole library and sets as one backup file. */
export function downloadLibrary(songs: Song[], setlists: Setlist[] = []): void {
  const blob = new Blob([libraryToJson(songs, setlists)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "chordsheet-library.json";
  a.click();
  URL.revokeObjectURL(url);
}

/** Browser-only: trigger a download of the song as <id>.json. */
export function downloadSong(song: Song): void {
  const blob = new Blob([songToJson(song)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${song.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
