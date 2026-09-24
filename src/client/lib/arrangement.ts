import type {
  Arrangement,
  ArrangementStep,
  ChordPlacement,
  SectionMark,
  Song,
} from "../../shared/types";
import { markFor, sectionRanges, stripBrackets } from "./sectionMarks";
import { slugify } from "./storage";

/**
 * Arrangements are orderings over the song's own sections: a step names a
 * section by its label line and occurrence (the same anchor section marks
 * use), so edits to the words and chords in the original flow into every
 * arrangement. Rendering materializes an ordinary Song, so print, plain
 * text, diagrams, and the screen sheet all work on it unchanged.
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

/** The song as written: every section once, in order. */
export function defaultSteps(song: Song): ArrangementStep[] {
  return arrangeableSections(song).map((s) => ({ section: s.section, occurrence: s.occurrence }));
}

/**
 * The section a step plays. A bare label with no lines under it borrows the
 * first same-named section that has content, so "[Chorus]" written as a
 * repeat marker plays the chorus. Null when the section no longer exists.
 */
export function resolveStep(
  sections: ArrangeableSection[],
  step: ArrangementStep,
): ArrangeableSection | null {
  const exact = sections.find((s) => s.section === step.section && s.occurrence === step.occurrence);
  if (!exact) return null;
  if (exact.hasContent) return exact;
  return sections.find((s) => s.section === step.section && s.hasContent) ?? exact;
}

export interface ArrangedSong {
  /** An ordinary Song holding the arranged lines; render it like any other. */
  song: Song;
  /** Indices of steps whose section no longer exists in the song. */
  missing: number[];
}

export function renderArrangement(song: Song, arrangement: Arrangement): ArrangedSong {
  const sections = arrangeableSections(song);
  const sourceMarks = song.sectionMarks ?? [];
  const lyrics: string[] = [];
  const placements: ChordPlacement[] = [];
  const sectionMarks: SectionMark[] = [];
  const labelCounts = new Map<string, number>();
  const missing: number[] = [];

  arrangement.steps.forEach((step, k) => {
    const source = resolveStep(sections, step);
    if (!source) {
      missing.push(k);
      return;
    }
    const first = lyrics.length === 0;
    if (!first) lyrics.push("");

    const repeat = step.repeat ?? 1;
    const suffix = repeat > 1 ? ` x${repeat}` : "";
    const note = step.note?.trim();
    const labeled = step.section !== OPENING;
    // Unlabeled opening lines get a label once they need one: a repeat, a
    // cue, a mark, or a place after another section they would otherwise join.
    if (labeled || suffix || note || step.mark || !first) {
      const base = labeled ? stripBrackets(step.section) : stepTitle(OPENING, 1);
      const label = `[${base}${suffix}]`;
      const occurrence = (labelCounts.get(label) ?? 0) + 1;
      labelCounts.set(label, occurrence);
      lyrics.push(label);

      // The step's own mark wins; null clears; absent inherits the section's.
      const inherited =
        markFor(sourceMarks, step.section, step.occurrence) ??
        markFor(sourceMarks, source.section, source.occurrence);
      const style = step.mark === undefined ? inherited : step.mark;
      if (style) {
        sectionMarks.push({
          section: label,
          occurrence,
          kind: style.kind,
          ...(style.text ? { text: style.text } : {}),
          ...(style.color ? { color: style.color } : {}),
        });
      }
    }
    if (note) lyrics.push(`(${note})`);

    const offset = lyrics.length - source.start;
    for (let i = source.start; i <= source.end; i++) lyrics.push(song.lyrics[i]);
    for (const p of song.placements) {
      if (p.line < source.start || p.line > source.end) continue;
      placements.push({ ...p, id: `${p.id}~${k}`, line: p.line + offset });
    }
  });

  return {
    song: {
      ...song,
      lyrics,
      placements,
      sectionMarks: sectionMarks.length > 0 ? sectionMarks : undefined,
      arrangements: undefined,
    },
    missing,
  };
}

export function createArrangement(song: Song, name: string, steps?: ArrangementStep[]): Arrangement {
  const now = new Date().toISOString();
  const taken = new Set((song.arrangements ?? []).map((a) => a.id));
  const trimmed = name.trim() || "Arrangement";
  return {
    id: slugify(trimmed, taken),
    name: trimmed,
    steps: steps ?? defaultSteps(song),
    createdAt: now,
    updatedAt: now,
  };
}

/** Insert or replace by id; stamps updatedAt. */
export function withArrangement(song: Song, arrangement: Arrangement): Song {
  const stamped = { ...arrangement, updatedAt: new Date().toISOString() };
  const list = song.arrangements ?? [];
  const exists = list.some((a) => a.id === arrangement.id);
  return {
    ...song,
    arrangements: exists
      ? list.map((a) => (a.id === arrangement.id ? stamped : a))
      : [...list, stamped],
  };
}

export function withoutArrangement(song: Song, id: string): Song {
  const rest = (song.arrangements ?? []).filter((a) => a.id !== id);
  return { ...song, arrangements: rest.length > 0 ? rest : undefined };
}

export function moveStep(steps: ArrangementStep[], index: number, delta: number): ArrangementStep[] {
  const target = index + delta;
  if (index < 0 || index >= steps.length || target < 0 || target >= steps.length) return steps;
  const out = [...steps];
  const [moved] = out.splice(index, 1);
  out.splice(target, 0, moved);
  return out;
}

/** Copy a step in place, right after itself: a double chorus. */
export function duplicateStep(steps: ArrangementStep[], index: number): ArrangementStep[] {
  if (index < 0 || index >= steps.length) return steps;
  return [...steps.slice(0, index + 1), { ...steps[index] }, ...steps.slice(index + 1)];
}

export function removeStep(steps: ArrangementStep[], index: number): ArrangementStep[] {
  if (index < 0 || index >= steps.length) return steps;
  return steps.filter((_, i) => i !== index);
}

export const MAX_REPEAT = 16;

export function updateStep(
  steps: ArrangementStep[],
  index: number,
  patch: Partial<ArrangementStep>,
): ArrangementStep[] {
  if (index < 0 || index >= steps.length) return steps;
  return steps.map((s, i) => {
    if (i !== index) return s;
    const next: ArrangementStep = { ...s, ...patch };
    const repeat = Math.min(MAX_REPEAT, Math.max(1, Math.round(next.repeat ?? 1)));
    if (repeat > 1) next.repeat = repeat;
    else delete next.repeat;
    if (!next.note?.trim()) delete next.note;
    return next;
  });
}
