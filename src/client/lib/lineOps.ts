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
  const edited = { ...song, lyrics: n.lyrics, placements: n.placements };
  return retargetSections(edited, song.lyrics, lyrics, (i) => i).song;
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
  const edited = { ...song, lyrics: n.lyrics, placements: n.placements };
  const lineMap = (i: number) => (i < index ? i : i > index ? i - 1 : undefined);
  return retargetSections(edited, song.lyrics, lyrics, lineMap).song;
}

export interface ReplacedLyrics {
  song: Song;
  /** Chords whose line no longer exists. */
  droppedChords: number;
  /** Marks and version steps whose section label was removed. */
  droppedRefs: number;
}

/**
 * Save a whole-text lyrics edit. Chords stay on their line numbers (a line
 * past the new end drops its chords). Section references follow their label
 * lines, matched by unchanged text first, so deleting or adding a label in
 * the middle never shifts a reference onto another section.
 */
export function replaceLyrics(song: Song, lines: string[]): ReplacedLyrics {
  const kept = song.placements.filter((p) => p.line < lines.length);
  const n = normalizeSections(lines, kept);
  const edited = { ...song, lyrics: n.lyrics, placements: n.placements };
  const matched = matchLines(song.lyrics, lines);
  const retargeted = retargetSections(edited, song.lyrics, lines, (i) => matched.get(i));
  return {
    song: retargeted.song,
    droppedChords: song.placements.length - kept.length,
    droppedRefs: retargeted.dropped,
  };
}

/**
 * Longest common subsequence of two line lists: old index to new index for
 * every line kept unchanged. Songs run to a few hundred lines, so the
 * quadratic table is cheap.
 */
export function matchLines(before: string[], after: string[]): Map<number, number> {
  const rows = before.length + 1;
  const cols = after.length + 1;
  const table = new Uint16Array(rows * cols);
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      table[i * cols + j] =
        before[i] === after[j]
          ? table[(i + 1) * cols + j + 1] + 1
          : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
    }
  }
  const map = new Map<number, number>();
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      map.set(i, j);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return map;
}

interface LabelAt {
  line: number;
  section: string;
  occurrence: number;
}

/** Each label line with its anchor: label text plus occurrence among equal labels. */
function labelsAt(lyrics: string[]): LabelAt[] {
  const counts = new Map<string, number>();
  const out: LabelAt[] = [];
  lyrics.forEach((line, i) => {
    if (!isSectionLabel(line)) return;
    const section = line.trim();
    const occurrence = (counts.get(section) ?? 0) + 1;
    counts.set(section, occurrence);
    out.push({ line: i, section, occurrence });
  });
  return out;
}

type Ref = { section: string; occurrence: number };
const refKey = (r: Ref) => `${r.occurrence}:${r.section}`;

/**
 * Section marks and version steps name a section by label text and
 * occurrence, so any edit that renames, adds, or removes a label can leave
 * them pointing at a different section than the one they were made for.
 * This follows each label line through the edit instead:
 *
 * - lineMap says where an old line went (undefined: deleted or rewritten).
 *   A label whose line lands on a label is that label, renamed or not, and
 *   its references take the new anchor (occurrences shift with it).
 * - Labels left unmatched on both sides pair up in order when the counts
 *   agree: that is a rename through a whole-text edit.
 * - Any other unmatched old label is gone. Its marks and version steps are
 *   dropped rather than left to resolve to whichever section now holds the
 *   old anchor. Its lines joined the section above, so a version still
 *   plays them there.
 *
 * oldLyrics and newLyrics are before normalization; normalizing only
 * removes blank lines, so label order and anchors are the same after it.
 * The references on `song` are still the old ones and get rewritten.
 */
export function retargetSections(
  song: Song,
  oldLyrics: string[],
  newLyrics: string[],
  lineMap: (line: number) => number | undefined,
): { song: Song; dropped: number } {
  const before = labelsAt(oldLyrics);
  const after = labelsAt(newLyrics);
  const afterByLine = new Map(after.map((l) => [l.line, l]));
  const claimed = new Set<number>();
  const map = new Map<string, Ref | null>();
  const unmatched: LabelAt[] = [];
  for (const old of before) {
    const line = lineMap(old.line);
    const hit = line === undefined ? undefined : afterByLine.get(line);
    if (hit && !claimed.has(hit.line)) {
      claimed.add(hit.line);
      map.set(refKey(old), { section: hit.section, occurrence: hit.occurrence });
    } else {
      unmatched.push(old);
    }
  }
  const fresh = after.filter((l) => !claimed.has(l.line));
  unmatched.forEach((old, k) => {
    const renamed = unmatched.length === fresh.length ? fresh[k] : undefined;
    map.set(refKey(old), renamed ? { section: renamed.section, occurrence: renamed.occurrence } : null);
  });

  const changed = [...map].some(([key, next]) => next === null || refKey(next) !== key);
  if (!changed) return { song, dropped: 0 };

  let dropped = 0;
  // Keys absent from the map (the unlabeled opening, steps already missing) stay as they are.
  const follow = <T extends Ref>(refs: T[]): T[] =>
    refs.flatMap((ref) => {
      const key = refKey(ref);
      if (!map.has(key)) return [ref];
      const next = map.get(key);
      if (!next) {
        dropped += 1;
        return [];
      }
      return [next.section === ref.section && next.occurrence === ref.occurrence ? ref : { ...ref, ...next }];
    });

  const marks = song.sectionMarks ? follow(song.sectionMarks) : undefined;
  const arrangements = song.arrangements?.map((a) => ({ ...a, steps: follow(a.steps) }));
  return {
    song: {
      ...song,
      ...(song.sectionMarks ? { sectionMarks: marks && marks.length > 0 ? marks : undefined } : {}),
      ...(arrangements ? { arrangements } : {}),
    },
    dropped,
  };
}

/** Version steps that play the section this label line starts; 0 for any other line. */
export function stepsUsingLabel(song: Song, index: number): number {
  const label = labelsAt(song.lyrics).find((l) => l.line === index);
  if (!label) return 0;
  return (song.arrangements ?? []).reduce(
    (n, a) => n + a.steps.filter((s) => s.section === label.section && s.occurrence === label.occurrence).length,
    0,
  );
}

export function chordsOnLine(song: Song, index: number): number {
  return song.placements.filter((p) => p.line === index).length;
}
