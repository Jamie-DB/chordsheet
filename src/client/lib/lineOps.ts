import type { Song } from "../../shared/types";
import { normalizeSections } from "./normalize";

/** A bracketed line like "[Chorus]" renders as a section heading. */
export function isSectionLabel(line: string): boolean {
  return /^\[.+\]$/.test(line.trim());
}

/**
 * Replace one line's text; nothing else moves. Chords keep their columns
 * even past the new end of the words, a legitimate state used for
 * between-phrase progressions.
 */
export function editLine(song: Song, index: number, text: string): Song {
  const cleaned = text.replace(/\t/g, "    ").replace(/\s+$/g, "");
  const lyrics = song.lyrics.map((l, i) => (i === index ? cleaned : l));
  const n = normalizeSections(lyrics, song.placements);
  return retargetSections(song, { ...song, lyrics: n.lyrics, placements: n.placements });
}

/** Each label line's anchor in order: label text plus its occurrence among equal labels. */
function labelKeys(lyrics: string[]): Array<{ section: string; occurrence: number }> {
  const counts = new Map<string, number>();
  return lyrics.filter(isSectionLabel).map((line) => {
    const section = line.trim();
    const occurrence = (counts.get(section) ?? 0) + 1;
    counts.set(section, occurrence);
    return { section, occurrence };
  });
}

/**
 * Section marks and arrangement steps name a section by label text and
 * occurrence, so renaming a label would orphan them. When an edit keeps the
 * same number of labels, the nth label before is the nth label after, and
 * every reference follows it (occurrence shifts among equal labels included).
 * An edit that adds or removes a label leaves references alone.
 */
export function retargetSections(before: Song, after: Song): Song {
  const from = labelKeys(before.lyrics);
  const to = labelKeys(after.lyrics);
  if (from.length !== to.length) return after;
  const map = new Map<string, { section: string; occurrence: number }>();
  from.forEach((k, i) => {
    if (k.section !== to[i].section || k.occurrence !== to[i].occurrence) {
      map.set(`${k.occurrence}:${k.section}`, to[i]);
    }
  });
  if (map.size === 0) return after;
  const retarget = <T extends { section: string; occurrence: number }>(ref: T): T => {
    const next = map.get(`${ref.occurrence}:${ref.section}`);
    return next ? { ...ref, ...next } : ref;
  };
  return {
    ...after,
    ...(after.sectionMarks ? { sectionMarks: after.sectionMarks.map(retarget) } : {}),
    ...(after.arrangements
      ? { arrangements: after.arrangements.map((a) => ({ ...a, steps: a.steps.map(retarget) })) }
      : {}),
  };
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
