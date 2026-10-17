import type { MarkColor, MarkKind, SectionMark, SectionRef } from "../../shared/types";
import { isSectionLabel } from "./lineOps";

export const PRESETS: Record<Exclude<MarkKind, "custom">, { name: string }> = {
  tacet: { name: "Tacet" },
  soft: { name: "Soft" },
  build: { name: "Build" },
  full: { name: "Full" },
};

/** What part of the song a section is; the side bar color follows it. */
export type SectionType =
  | "intro"
  | "verse"
  | "prechorus"
  | "chorus"
  | "bridge"
  | "tag"
  | "outro"
  | "instrumental"
  | "other";

/** First match wins, so "Pre-Chorus" and "Post-Chorus" beat "Chorus". */
const SECTION_TYPE_RULES: Array<[RegExp, SectionType]> = [
  [/\bpre[- ]?chorus\b/, "prechorus"],
  [/\bpost[- ]?chorus\b|\btag(line)?\b|\bvamp\b/, "tag"],
  [/\bchorus\b|\brefrain\b|\bhook\b/, "chorus"],
  [/\bverse\b/, "verse"],
  [/\bbridge\b/, "bridge"],
  [/\bintro\b/, "intro"],
  [/\boutro\b|\bending\b|\bcoda\b/, "outro"],
  [/\binstrumental\b|\binterlude\b|\bsolo\b|\bturnaround\b|\bbreak\b/, "instrumental"],
];

/** "[Verse 2]" to "verse"; anything unrecognized is "other". */
export function sectionType(label: string): SectionType {
  const name = stripBrackets(label).toLowerCase();
  return SECTION_TYPE_RULES.find(([re]) => re.test(name))?.[1] ?? "other";
}

/** The displayed term: a free-text note overrides any preset's name. */
export function markName(mark: SectionMark): string {
  const note = mark.text?.trim();
  if (note) return note;
  return mark.kind === "custom" ? "Custom" : PRESETS[mark.kind].name;
}

/**
 * A section note that tells the player to move the capo ("Capo +1",
 * "capo -2"), as the badge text "CAPO +1"; null for any other note. The
 * chords stay as written, so the badge is the only sign of the move and
 * prints big and red.
 */
export function capoChange(note: string | null | undefined): string | null {
  const move = capoMove(note);
  return move === null ? null : `CAPO ${move > 0 ? "+" : "-"}${Math.abs(move)}`;
}

/** Frets a capo-move note moves the capo ("Capo +1" is 1), or null for any other note. */
export function capoMove(note: string | null | undefined): number | null {
  const m = /^\s*capo\s*([+-])\s*(\d{1,2})\s*$/i.exec(note ?? "");
  if (!m) return null;
  const frets = Number(m[2]);
  return frets === 0 ? null : m[1] === "-" ? -frets : frets;
}

/**
 * The capo each line is played at: the chart's capo, moved by every
 * capo-move note on a section at or above the line. A move only changes
 * which shapes the chords display as; stored chords stay sounding. Never
 * below 0.
 */
export function capoByLine(lyrics: string[], marks: SectionMark[], capo: number): number[] {
  const at = lyrics.map(() => capo);
  let current = capo;
  let next = 0;
  for (const r of sectionRanges(lyrics)) {
    const move = capoMove(markFor(marks, r.label, r.occurrence)?.text);
    for (; next < r.start; next++) at[next] = current;
    if (move !== null) current = Math.max(0, current + move);
  }
  for (; next < lyrics.length; next++) at[next] = current;
  return at;
}

/** "[Verse 1]" to "Verse 1" for tags and sidebars. */
export function stripBrackets(label: string): string {
  return label.trim().replace(/^\[|\]$/g, "");
}

export interface SectionRange {
  label: string;
  occurrence: number;
  start: number;
  /** Inclusive; runs to the line before the next label, or the song's end. */
  end: number;
}

export function sectionRanges(lyrics: string[]): SectionRange[] {
  const counts = new Map<string, number>();
  const out: SectionRange[] = [];
  lyrics.forEach((line, i) => {
    if (!isSectionLabel(line)) return;
    const label = line.trim();
    const occurrence = (counts.get(label) ?? 0) + 1;
    counts.set(label, occurrence);
    if (out.length > 0) out[out.length - 1].end = i - 1;
    out.push({ label, occurrence, start: i, end: lyrics.length - 1 });
  });
  return out;
}

export interface SectionStyling {
  /** Section type for every line inside a section, label line included. */
  typeByLine: Map<number, SectionType>;
  /** Lines inside a tacet section, drawn smaller. */
  tacetLines: Set<number>;
}

/** Per-line section type and tacet flags, shared by the editor and print. */
export function sectionStyling(lyrics: string[], marks: SectionMark[]): SectionStyling {
  const typeByLine = new Map<number, SectionType>();
  const tacetLines = new Set<number>();
  for (const r of sectionRanges(lyrics)) {
    const type = sectionType(r.label);
    const tacet = markFor(marks, r.label, r.occurrence)?.kind === "tacet";
    for (let i = r.start; i <= r.end; i++) {
      typeByLine.set(i, type);
      if (tacet) tacetLines.add(i);
    }
  }
  return { typeByLine, tacetLines };
}

export interface OutStyling {
  /** Every line of every out run, trailing blank lines trimmed. */
  lines: Set<number>;
  /** The label line that opens each run, where the OUT stamp goes. */
  starts: Set<number>;
  /** The last line of each run, where the line ends in a foot. */
  ends: Set<number>;
}

/**
 * Back-to-back sections the player sits out join into one run, drawn as a
 * single stamped line like a pen markup. A run ends at its last line with
 * words or chords, so the foot lands where playing resumes.
 */
export function outStyling(lyrics: string[], outs: SectionRef[], chordLines: Set<number>): OutStyling {
  const lines = new Set<number>();
  const starts = new Set<number>();
  const ends = new Set<number>();
  const isOut = (r: SectionRange) => outs.some((o) => o.section === r.label && o.occurrence === r.occurrence);
  const ranges = sectionRanges(lyrics);
  for (let k = 0; k < ranges.length; k++) {
    if (!isOut(ranges[k])) continue;
    const first = ranges[k];
    while (k + 1 < ranges.length && isOut(ranges[k + 1])) k += 1;
    let end = ranges[k].end;
    while (end > ranges[k].start && lyrics[end].trim() === "" && !chordLines.has(end)) end -= 1;
    for (let i = first.start; i <= end; i++) lines.add(i);
    starts.add(first.start);
    ends.add(end);
  }
  return { lines, starts, ends };
}

export function markFor(
  marks: SectionMark[],
  label: string,
  occurrence: number,
): SectionMark | null {
  return marks.find((m) => m.section === label && m.occurrence === occurrence) ?? null;
}

export function withMark(marks: SectionMark[], mark: SectionMark): SectionMark[] {
  return [
    ...marks.filter((m) => !(m.section === mark.section && m.occurrence === mark.occurrence)),
    mark,
  ];
}

/** Best-guess preset for a promoted note; wrong guesses are one click away. */
export function inferKind(note: string): { kind: MarkKind; color?: MarkColor } {
  const n = note.toLowerCase();
  if (/\btacet\b|don'?t play/.test(n)) return { kind: "tacet" };
  if (/soft|quiet|piano only|gentle/.test(n)) return { kind: "soft" };
  if (/build|swell|rise|grow/.test(n)) return { kind: "build" };
  if (/\bfull\b|loud|all in/.test(n)) return { kind: "full" };
  return { kind: "custom", color: "amber" };
}

const LABEL_WITH_NOTE = /^(\s*\[[^\]]+\])\s+(\S.*)$/;

export interface ExtractResult {
  lyrics: string[];
  sectionMarks: SectionMark[];
  changed: boolean;
  converted: number;
}

/**
 * Promote inline label notes ("[Verse 1] *soft piano only*") into real
 * section marks: the line becomes the bare label and the note becomes the
 * tag's term with an inferred preset. Existing marks are never clobbered.
 * Line count never changes, so placements need no remapping. Deterministic,
 * so browser migration and the disk script converge identically.
 */
export function extractLabelNotes(lyrics: string[], marks: SectionMark[]): ExtractResult {
  const found: Array<{ index: number; note: string }> = [];
  const newLyrics = lyrics.map((line, i) => {
    const m = LABEL_WITH_NOTE.exec(line);
    if (!m || !isSectionLabel(m[1])) return line;
    const note = m[2].trim().replace(/^\*+\s*/, "").replace(/\s*\*+$/, "").trim();
    if (note.length > 0) found.push({ index: i, note });
    return m[1].trim();
  });
  if (found.length === 0) return { lyrics, sectionMarks: marks, changed: false, converted: 0 };

  // Occurrences count against the REWRITTEN lyrics; rewrites can merge labels.
  const counts = new Map<string, number>();
  const occurrenceAt = new Map<number, { label: string; occurrence: number }>();
  newLyrics.forEach((line, i) => {
    if (!isSectionLabel(line)) return;
    const label = line.trim();
    const occurrence = (counts.get(label) ?? 0) + 1;
    counts.set(label, occurrence);
    occurrenceAt.set(i, { label, occurrence });
  });

  let out = marks;
  let converted = 0;
  for (const f of found) {
    const at = occurrenceAt.get(f.index);
    if (!at || markFor(out, at.label, at.occurrence)) continue;
    const inferred = inferKind(f.note);
    out = withMark(out, {
      section: at.label,
      occurrence: at.occurrence,
      kind: inferred.kind,
      text: f.note,
      ...(inferred.kind === "custom" ? { color: inferred.color } : {}),
    });
    converted += 1;
  }
  return { lyrics: newLyrics, sectionMarks: out, changed: true, converted };
}

export function withoutMark(
  marks: SectionMark[],
  label: string,
  occurrence: number,
): SectionMark[] {
  return marks.filter((m) => !(m.section === label && m.occurrence === occurrence));
}
