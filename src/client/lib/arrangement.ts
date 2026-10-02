import type { ChordPlacement, MarkStyle, SectionMark, SectionRef, Song } from "../../shared/types";
import { freshId } from "./ids";
import { parseLabel } from "./printRepeats";
import { markFor, sectionRanges, stripBrackets } from "./sectionMarks";

/**
 * Section operations on one chart (the song as written or a version). A
 * chart is cut into blocks, one per section, each carrying its own lines,
 * chords, mark, and OUT flag; an operation reorders or changes blocks and
 * the chart is laid back out with exactly one blank line between sections.
 * Marks and OUT sections are anchored by label text and occurrence, so they
 * are re-anchored from the blocks on every layout rather than patched.
 */

/** Step key for lines above the first label; there is no label to name them by. */
export const OPENING = "";

export interface ArrangeableSection {
  /** Label line text ("[Chorus]"), or OPENING for unlabeled lines at the top. */
  section: string;
  occurrence: number;
  /** "Chorus", "Chorus (2)", "Opening". */
  title: string;
  /** First content line (after the label). */
  start: number;
  /** Inclusive; trailing blank lines without chords excluded. */
  end: number;
  /** False for a bare label with nothing under it (a chart's "repeat chorus" shorthand). */
  hasContent: boolean;
}

export function stepTitle(section: string, occurrence: number): string {
  if (section === OPENING) return "Opening";
  const base = stripBrackets(section);
  return occurrence > 1 ? `${base} (${occurrence})` : base;
}

/** Every section the song offers, in song order, the unlabeled opening included when present. */
export function arrangeableSections(song: Song): ArrangeableSection[] {
  const chordLines = new Set(song.placements.map((p) => p.line));
  const isContent = (i: number) => song.lyrics[i].trim() !== "" || chordLines.has(i);
  const trimEnd = (start: number, end: number) => {
    let e = end;
    while (e >= start && !isContent(e)) e -= 1;
    return e;
  };

  const out: ArrangeableSection[] = [];
  const ranges = sectionRanges(song.lyrics);
  const openingEnd = trimEnd(0, (ranges[0]?.start ?? song.lyrics.length) - 1);
  if (openingEnd >= 0) {
    let openingStart = 0;
    while (!isContent(openingStart)) openingStart += 1;
    out.push({
      section: OPENING,
      occurrence: 1,
      title: stepTitle(OPENING, 1),
      start: openingStart,
      end: openingEnd,
      hasContent: true,
    });
  }
  for (const r of ranges) {
    const start = r.start + 1;
    const end = trimEnd(start, r.end);
    out.push({
      section: r.label,
      occurrence: r.occurrence,
      title: stepTitle(r.label, r.occurrence),
      start,
      end,
      hasContent: end >= start,
    });
  }
  return out;
}

export const MAX_REPEAT = 16;

/** One section's lines and everything attached to it. */
export interface Block {
  /** The trimmed label line ("[Chorus x2]"), or null for the unlabeled opening. */
  label: string | null;
  /** Label line included when there is one. */
  lines: string[];
  /** Chords with lines relative to the block's first line. */
  chords: ChordPlacement[];
  mark: MarkStyle | null;
  out: boolean;
}

/** Cut a chart into its sections, in the order the order strip lists them. */
export function toBlocks(song: Song): Block[] {
  const marks = song.sectionMarks ?? [];
  const outs = song.outSections ?? [];
  return arrangeableSections(song).map((s) => {
    const labeled = s.section !== OPENING;
    const first = labeled ? s.start - 1 : s.start;
    const mark = labeled ? markFor(marks, s.section, s.occurrence) : null;
    return {
      label: labeled ? s.section : null,
      lines: song.lyrics.slice(first, s.end + 1),
      chords: song.placements
        .filter((p) => p.line >= first && p.line <= s.end)
        .map((p) => ({ ...p, line: p.line - first })),
      mark: mark ? { kind: mark.kind, ...(mark.text ? { text: mark.text } : {}), ...(mark.color ? { color: mark.color } : {}) } : null,
      out: labeled && outs.some((o) => o.section === s.section && o.occurrence === s.occurrence),
    };
  });
}

/** Lay blocks back out as a chart, keeping the rest of the song's fields. */
export function fromBlocks(song: Song, blocks: Block[]): Song {
  const lyrics: string[] = [];
  const placements: ChordPlacement[] = [];
  const sectionMarks: SectionMark[] = [];
  const outSections: SectionRef[] = [];
  const counts = new Map<string, number>();
  blocks.forEach((block, k) => {
    if (k > 0) lyrics.push("");
    const offset = lyrics.length;
    lyrics.push(...block.lines);
    for (const c of block.chords) placements.push({ ...c, line: c.line + offset });
    if (block.label === null) return;
    const occurrence = (counts.get(block.label) ?? 0) + 1;
    counts.set(block.label, occurrence);
    if (block.mark) sectionMarks.push({ section: block.label, occurrence, ...block.mark });
    if (block.out) outSections.push({ section: block.label, occurrence });
  });
  return {
    ...song,
    lyrics,
    placements,
    sectionMarks: sectionMarks.length > 0 ? sectionMarks : undefined,
    outSections: outSections.length > 0 ? outSections : undefined,
  };
}

/** Run an edit over one section's block; an unknown index changes nothing. */
function editBlocks(song: Song, k: number, edit: (blocks: Block[]) => Block[]): Song {
  const blocks = toBlocks(song);
  if (k < 0 || k >= blocks.length) return song;
  return fromBlocks(song, edit(blocks));
}

/** Move a section one place earlier or later. */
export function moveSection(song: Song, k: number, delta: number): Song {
  const target = k + delta;
  return editBlocks(song, k, (blocks) => {
    if (target < 0 || target >= blocks.length) return blocks;
    const out = [...blocks];
    [out[k], out[target]] = [out[target], out[k]];
    return out;
  });
}

/** Copies get fresh chord ids, so a chord is only ever found by one id. */
function freshened(block: Block): Block {
  return { ...block, chords: block.chords.map((c) => ({ ...c, id: freshId() })) };
}

/** Play a section again right after itself: a double chorus. */
export function duplicateSection(song: Song, k: number): Song {
  return editBlocks(song, k, (blocks) => [...blocks.slice(0, k + 1), freshened(blocks[k]), ...blocks.slice(k + 1)]);
}

export function removeSection(song: Song, k: number): Song {
  return editBlocks(song, k, (blocks) => blocks.filter((_, i) => i !== k));
}

/**
 * Put a section copied from another chart (or this one) at this index,
 * clamped to the ends. Its mark and OUT flag come along.
 */
export function insertSection(song: Song, at: number, block: Block): Song {
  const blocks = toBlocks(song);
  const index = Math.min(blocks.length, Math.max(0, at));
  return fromBlocks(song, [...blocks.slice(0, index), freshened(block), ...blocks.slice(index)]);
}

/**
 * A section with no label (the opening lines) gets one once it needs one
 * to carry a repeat count or an OUT stamp.
 */
function labeled(block: Block): Block {
  if (block.label !== null) return block;
  return {
    ...block,
    label: "[Opening]",
    lines: ["[Opening]", ...block.lines],
    chords: block.chords.map((c) => ({ ...c, line: c.line + 1 })),
  };
}

/** Play the section this many times, printed once as "x3" on its label. */
export function setRepeat(song: Song, k: number, count: number): Song {
  const n = Math.min(MAX_REPEAT, Math.max(1, Math.round(count)));
  return editBlocks(song, k, (blocks) =>
    blocks.map((b, i) => {
      if (i !== k) return b;
      const withLabel = labeled(b);
      const label = `[${parseLabel(withLabel.label ?? "").base}${n > 1 ? ` x${n}` : ""}]`;
      return { ...withLabel, label, lines: [label, ...withLabel.lines.slice(1)] };
    }),
  );
}

/** The player sits the section out: it prints small under an OUT stamp. */
export function toggleOut(song: Song, k: number): Song {
  return editBlocks(song, k, (blocks) =>
    blocks.map((b, i) => (i === k ? { ...labeled(b), out: !b.out } : b)),
  );
}

/** Whether every chord in the block is a hold, and there is at least one. */
function allHolds(block: Block): boolean {
  return block.chords.length > 0 && block.chords.every((c) => c.hold === true);
}

/** Every chord in the section prints as a full-measure hold (diamond), or back to plain. */
export function toggleDiamonds(song: Song, k: number): Song {
  return editBlocks(song, k, (blocks) =>
    blocks.map((b, i) => {
      if (i !== k) return b;
      const on = !allHolds(b);
      return {
        ...b,
        chords: b.chords.map(({ hold: _hold, ...c }) => (on ? { ...c, hold: true } : c)),
      };
    }),
  );
}

/** What the order strip and section controls show for one section. */
export interface SectionSummary {
  title: string;
  repeat: number;
  out: boolean;
  diamonds: boolean;
  /** The section's label line, where its tag sits on the sheet; null for the opening. */
  labelLine: number | null;
  /** First and last line of the section, label included. */
  start: number;
  end: number;
  hasContent: boolean;
}

export function sectionSummaries(song: Song): SectionSummary[] {
  const blocks = toBlocks(song);
  return arrangeableSections(song).map((s, k) => {
    const labeledSection = s.section !== OPENING;
    const { base, count } = labeledSection ? parseLabel(s.section) : { base: stepTitle(OPENING, 1), count: 1 };
    return {
      title: base,
      repeat: count,
      out: blocks[k].out,
      diamonds: allHolds(blocks[k]),
      labelLine: labeledSection ? s.start - 1 : null,
      start: labeledSection ? s.start - 1 : s.start,
      end: s.end,
      hasContent: s.hasContent,
    };
  });
}
