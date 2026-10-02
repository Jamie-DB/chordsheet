import type {
  Arrangement,
  ChordPlacement,
  MarkStyle,
  SectionMark,
  SectionRef,
  Song,
} from "../../shared/types";
import { OPENING, arrangeableSections, stepTitle, type ArrangeableSection } from "./arrangement";
import { markFor, stripBrackets } from "./sectionMarks";

/**
 * Versions used to be an ordering over the song's own sections, with words
 * and chords living only in the song as written. Versions now own a full
 * chart, so this reads the old form once: each old version is rendered
 * through its steps exactly as print did, and the result becomes the
 * version's own chart. Key, capo, tempo, and notes were the song's, so each
 * version starts with the song's values.
 */

/** One block of an old version: a section, found by label text and occurrence. */
export interface LegacyStep {
  section: string;
  occurrence: number;
  repeat?: number;
  note?: string;
  /** Overrides the section's own mark; null clears it for this step. */
  mark?: MarkStyle | null;
  out?: boolean;
  hold?: boolean;
}

export interface LegacyArrangement {
  id: string;
  name: string;
  steps: LegacyStep[];
  createdAt: string;
  updatedAt: string;
}

/** A song as stored: versions may still be in the old form. */
export type StoredSong = Omit<Song, "arrangements"> & {
  arrangements?: Array<Arrangement | LegacyArrangement>;
};

function isLegacy(version: Arrangement | LegacyArrangement): version is LegacyArrangement {
  return "steps" in version;
}

/**
 * The section a step plays. A bare label with no lines under it borrows the
 * first same-named section that has content, so "[Chorus]" written as a
 * repeat marker plays the chorus. Null when the section no longer exists.
 */
function resolveStep(sections: ArrangeableSection[], step: LegacyStep): ArrangeableSection | null {
  const exact = sections.find((s) => s.section === step.section && s.occurrence === step.occurrence);
  if (!exact) return null;
  if (exact.hasContent) return exact;
  return sections.find((s) => s.section === step.section && s.hasContent) ?? exact;
}

/** The old materialization: every step's lines laid out in order, one blank between. */
function renderLegacy(song: Song, version: LegacyArrangement): Song {
  const sections = arrangeableSections(song);
  const sourceMarks = song.sectionMarks ?? [];
  const lyrics: string[] = [];
  const placements: ChordPlacement[] = [];
  const sectionMarks: SectionMark[] = [];
  const outSections: SectionRef[] = [];
  const labelCounts = new Map<string, number>();

  version.steps.forEach((step, k) => {
    const source = resolveStep(sections, step);
    if (!source) return;
    const first = lyrics.length === 0;
    if (!first) lyrics.push("");

    const repeat = step.repeat ?? 1;
    const suffix = repeat > 1 ? ` x${repeat}` : "";
    const note = step.note?.trim();
    const labeled = step.section !== OPENING;
    // Unlabeled opening lines get a label once they need one: a repeat, a
    // cue, a mark, an out, or a place after another section they would
    // otherwise join.
    if (labeled || suffix || note || step.mark || step.out || !first) {
      const base = labeled ? stripBrackets(step.section) : stepTitle(OPENING, 1);
      const label = `[${base}${suffix}]`;
      const occurrence = (labelCounts.get(label) ?? 0) + 1;
      labelCounts.set(label, occurrence);
      lyrics.push(label);
      if (step.out) outSections.push({ section: label, occurrence });

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
      placements.push({
        ...p,
        id: `${p.id}~${k}`,
        line: p.line + offset,
        ...(step.hold ? { hold: true } : {}),
      });
    }
  });

  return {
    ...song,
    lyrics,
    placements,
    sectionMarks: sectionMarks.length > 0 ? sectionMarks : undefined,
    outSections: outSections.length > 0 ? outSections : undefined,
    arrangements: undefined,
  };
}

/**
 * Turn any old-form versions into charts. A song with none comes back as
 * the same object, so callers can tell nothing changed.
 */
export function upgradeVersions(song: StoredSong): Song {
  const versions = song.arrangements;
  if (!versions || !versions.some(isLegacy)) return song as Song;
  const base = { ...song, arrangements: undefined } as Song;
  return {
    ...base,
    arrangements: versions.map((v): Arrangement => {
      if (!isLegacy(v)) return v;
      const rendered = renderLegacy(base, v);
      return {
        id: v.id,
        name: v.name,
        lyrics: rendered.lyrics,
        placements: rendered.placements,
        keyOverride: song.keyOverride,
        capo: song.capo,
        ...(song.bpm !== undefined ? { bpm: song.bpm } : {}),
        ...(song.notes !== undefined ? { notes: song.notes } : {}),
        ...(rendered.sectionMarks ? { sectionMarks: rendered.sectionMarks } : {}),
        ...(rendered.outSections ? { outSections: rendered.outSections } : {}),
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      };
    }),
  };
}
