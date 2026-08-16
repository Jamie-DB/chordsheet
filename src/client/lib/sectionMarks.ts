import type { MarkColor, MarkKind, SectionMark } from "../../shared/types";
import { isSectionLabel } from "./lineOps";

export const PRESETS: Record<Exclude<MarkKind, "custom">, { name: string; color: MarkColor }> = {
  tacet: { name: "Tacet", color: "red" },
  soft: { name: "Soft", color: "blue" },
  build: { name: "Build", color: "amber" },
  full: { name: "Full", color: "green" },
};

export const MARK_COLORS: MarkColor[] = ["red", "blue", "amber", "green"];

/** The displayed term: a free-text note overrides any preset's name. */
export function markName(mark: SectionMark): string {
  const note = mark.text?.trim();
  if (note) return note;
  return mark.kind === "custom" ? "Custom" : PRESETS[mark.kind].name;
}

/** "[Verse 1]" to "Verse 1" for tags and sidebars. */
export function stripBrackets(label: string): string {
  return label.trim().replace(/^\[|\]$/g, "");
}

export function markColor(mark: SectionMark): MarkColor {
  return mark.kind === "custom" ? (mark.color ?? "amber") : PRESETS[mark.kind].color;
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
