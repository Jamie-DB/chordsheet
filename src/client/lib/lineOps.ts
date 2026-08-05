import type { Song } from "../../shared/types";
import { normalizeSections } from "./normalize";

/** A bracketed line like "[Chorus]" renders as a section heading. */
export function isSectionLabel(line: string): boolean {
  return /^\[.+\]$/.test(line.trim());
}

/** Replace one line's text; that line's chords clamp, nothing else moves. */
export function editLine(song: Song, index: number, text: string): Song {
  const cleaned = text.replace(/\t/g, "    ").replace(/\s+$/g, "");
  const lyrics = song.lyrics.map((l, i) => (i === index ? cleaned : l));
  const placements = song.placements.map((p) =>
    p.line === index && p.col > cleaned.length ? { ...p, col: cleaned.length } : p,
  );
  const n = normalizeSections(lyrics, placements);
  return { ...song, lyrics: n.lyrics, placements: n.placements };
}

/** Insert an empty line at the index; chords on and below it shift down. */
export function insertLine(song: Song, at: number): Song {
  const lyrics = [...song.lyrics.slice(0, at), "", ...song.lyrics.slice(at)];
  const placements = song.placements.map((p) => (p.line >= at ? { ...p, line: p.line + 1 } : p));
  // No normalization here: the new blank line is about to receive text.
  return { ...song, lyrics, placements };
}

/** Delete a line and its chords; lines below shift up. */
export function deleteLine(song: Song, index: number): Song {
  const lyrics = song.lyrics.filter((_, i) => i !== index);
  const placements = song.placements
    .filter((p) => p.line !== index)
    .map((p) => (p.line > index ? { ...p, line: p.line - 1 } : p));
  const n = normalizeSections(lyrics, placements);
  return { ...song, lyrics: n.lyrics, placements: n.placements };
}

export function chordsOnLine(song: Song, index: number): number {
  return song.placements.filter((p) => p.line === index).length;
}
