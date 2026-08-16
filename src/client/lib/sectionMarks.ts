import type { MarkColor, MarkKind, SectionMark } from "../../shared/types";
import { isSectionLabel } from "./lineOps";

export const PRESETS: Record<Exclude<MarkKind, "custom">, { name: string; color: MarkColor }> = {
  tacet: { name: "Tacet", color: "red" },
  soft: { name: "Soft", color: "blue" },
  build: { name: "Build", color: "amber" },
  full: { name: "Full", color: "green" },
};

export const MARK_COLORS: MarkColor[] = ["red", "blue", "amber", "green"];

export function markName(mark: SectionMark): string {
  return mark.kind === "custom" ? mark.text?.trim() || "Custom" : PRESETS[mark.kind].name;
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

export function withoutMark(
  marks: SectionMark[],
  label: string,
  occurrence: number,
): SectionMark[] {
  return marks.filter((m) => !(m.section === label && m.occurrence === occurrence));
}
