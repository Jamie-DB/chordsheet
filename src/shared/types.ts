export interface ChordPlacement {
  id: string;
  line: number;
  col: number;
  /** Canonical SOUNDING chord symbol, e.g. "Bbmaj7", "G/B", "F#m7". */
  chord: string;
  /** Full-measure hold, drawn as a diamond (Nashville convention). */
  hold?: boolean;
}

export interface Song {
  version: 1;
  /** Slug; the export filename is `${id}.json`. */
  id: string;
  title: string;
  artist?: string;
  /** Lines verbatim from paste; tabs expanded, trailing whitespace trimmed. */
  lyrics: string[];
  placements: ChordPlacement[];
  /** "Eb", "Cm", ...; null means auto-detect from placements. */
  keyOverride: string | null;
  /** 0-9. Display transform only; stored chords stay sounding. */
  capo: number;
  /** Tempo for auto-scroll; absent means the 80 BPM default. */
  bpm?: number;
  /** Free-text block under the header: tuning, strum pattern, reminders. */
  notes?: string;
  /** Per-section dynamics marks for this arrangement. */
  sectionMarks?: SectionMark[];
  createdAt: string;
  updatedAt: string;
}

export type MarkColor = "red" | "blue" | "amber" | "green";
export type MarkKind = "tacet" | "soft" | "build" | "full" | "custom";

/**
 * A dynamics mark on one section, anchored by the label line's exact text
 * and its occurrence among identical labels, so line edits never shift it.
 */
export interface SectionMark {
  section: string;
  occurrence: number;
  kind: MarkKind;
  /** Custom marks only: a short word shown in place of the preset name. */
  text?: string;
  /** Custom marks only; presets carry fixed colors. */
  color?: MarkColor;
}

export interface Setlist {
  version: 1;
  /** Slug from the name; setlists sync as one setlists.json file. */
  id: string;
  name: string;
  /** Ordered; a song may appear more than once. */
  songIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SongSummary {
  id: string;
  title: string;
  artist?: string;
  updatedAt: string;
  capo: number;
}
