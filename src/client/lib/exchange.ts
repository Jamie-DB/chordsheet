import { resolveAnchor } from "../../engine";
import { importedSongSchema } from "../../shared/schemas";
import type { ChordPlacement, Song } from "../../shared/types";

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
      placements.push({
        id: p.id ?? freshId(),
        line: p.line,
        col: Math.max(0, Math.min(lineText.length, p.col)),
        chord: p.chord,
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
        placements.push({ id: freshId(), line: p.line, col, chord: p.chord });
      }
    }
  }

  return {
    ok: true,
    song: { ...base, placements },
    unresolved,
    lyricsRejected,
  };
}

export function songToJson(song: Song): string {
  return JSON.stringify(song, null, 2) + "\n";
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
