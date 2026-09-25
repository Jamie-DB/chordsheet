import type { ChordPlacement, SectionMark, Song } from "../../shared/types";
import { markFor, sectionRanges, stripBrackets } from "./sectionMarks";

/**
 * Back-to-back sections with the same label and the same words and chords
 * print once, as "[Chorus x2]", with each pass's dynamics listed under the
 * label. Print only: the stored song and the editor keep every section.
 */

/** One line of a merged section's pass list, e.g. "1-2: SOFT". */
export interface PassNote {
  /** "1", or "1-2" for consecutive passes with the same mark. */
  passes: string;
  mark: SectionMark;
}

export interface CollapsedSong {
  song: Song;
  /** Pass lists keyed by the output label line; only merged sections whose passes differ. */
  passNotes: Map<number, PassNote[]>;
}

const REPEAT_SUFFIX = /\s+x(\d+)$/;

/** "[Chorus x2]" to { base: "Chorus", count: 2 }; brackets optional. */
export function parseLabel(label: string): { base: string; count: number } {
  const title = stripBrackets(label);
  const m = REPEAT_SUFFIX.exec(title);
  return m ? { base: title.slice(0, m.index), count: Number(m[1]) } : { base: title, count: 1 };
}

function sameMark(a: SectionMark | null, b: SectionMark | null): boolean {
  if (!a || !b) return a === b;
  return a.kind === b.kind && (a.text ?? "") === (b.text ?? "") && (a.color ?? "") === (b.color ?? "");
}

/** A run of identical sections; the first one prints, the rest drop. */
interface Group {
  base: string;
  start: number;
  /** One entry per pass, in playing order. */
  marks: (SectionMark | null)[];
}

export function collapseRepeats(song: Song): CollapsedSong {
  const marks = song.sectionMarks ?? [];
  const chordLines = new Set(song.placements.map((p) => p.line));
  const isContent = (i: number) => song.lyrics[i].trim() !== "" || chordLines.has(i);

  /** Words and chords from the label line to the last content line, lines relative to the label. */
  const body = (start: number, end: number): string | null => {
    let e = end;
    while (e > start && !isContent(e)) e -= 1;
    if (e === start && !chordLines.has(start)) return null; // bare label, nothing to repeat
    const chords = song.placements
      .filter((p) => p.line >= start && p.line <= e)
      .map((p) => `${p.line - start}:${p.col}:${p.chord}:${p.hold ? 1 : 0}`)
      .sort();
    return JSON.stringify([song.lyrics.slice(start + 1, e + 1), chords]);
  };

  const ranges = sectionRanges(song.lyrics);
  const groups: Group[] = [];
  const dropped = new Set<number>();
  let groupBody: string | null = null;
  for (const r of ranges) {
    const { base, count } = parseLabel(r.label);
    const passes = Array<SectionMark | null>(count).fill(markFor(marks, r.label, r.occurrence));
    const b = body(r.start, r.end);
    const last = groups[groups.length - 1];
    if (last && b !== null && b === groupBody && last.base === base) {
      last.marks.push(...passes);
      for (let i = r.start; i <= r.end; i++) dropped.add(i);
      continue;
    }
    groups.push({ base, start: r.start, marks: passes });
    groupBody = b;
  }
  if (dropped.size === 0) return { song, passNotes: new Map() };

  const merged = new Map(groups.filter((g) => g.marks.length > 1).map((g) => [g.start, g]));
  const newLine = new Map<number, number>();
  const lyrics: string[] = [];
  song.lyrics.forEach((line, i) => {
    if (dropped.has(i)) return;
    newLine.set(i, lyrics.length);
    const g = merged.get(i);
    lyrics.push(g ? `[${g.base} x${g.marks.length}]` : line);
  });

  const placements: ChordPlacement[] = [];
  for (const p of song.placements) {
    const line = newLine.get(p.line);
    if (line !== undefined) placements.push({ ...p, line });
  }

  // Rebuild marks against the output labels, whose occurrences have shifted.
  const sectionMarks: SectionMark[] = [];
  const passNotes = new Map<number, PassNote[]>();
  const rangeAt = new Map(ranges.map((r) => [newLine.get(r.start), r]));
  for (const r of sectionRanges(lyrics)) {
    const old = rangeAt.get(r.start)!;
    const g = merged.get(old.start);
    let mark = markFor(marks, old.label, old.occurrence);
    if (g) {
      const uniform = g.marks.every((m) => sameMark(m, g.marks[0]));
      mark = uniform ? g.marks[0] : null;
      if (!uniform) passNotes.set(r.start, passList(g.marks));
    }
    if (mark) sectionMarks.push({ ...mark, section: r.label, occurrence: r.occurrence });
  }

  return {
    song: { ...song, lyrics, placements, sectionMarks: sectionMarks.length > 0 ? sectionMarks : undefined },
    passNotes,
  };
}

/** Runs of passes sharing a mark, unmarked passes left out: [SOFT, SOFT, FULL] to 1-2, 3. */
function passList(marks: (SectionMark | null)[]): PassNote[] {
  const out: PassNote[] = [];
  let i = 0;
  while (i < marks.length) {
    let j = i;
    while (j + 1 < marks.length && sameMark(marks[j + 1], marks[i])) j += 1;
    const mark = marks[i];
    if (mark) out.push({ passes: i === j ? `${i + 1}` : `${i + 1}-${j + 1}`, mark });
    i = j + 1;
  }
  return out;
}
