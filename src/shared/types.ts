export interface ChordPlacement {
  id: string;
  line: number;
  col: number;
  /** Canonical SOUNDING chord symbol, e.g. "Bbmaj7", "G/B", "F#m7". */
  chord: string;
  /** Full-measure hold, drawn as a diamond (Nashville convention). */
  hold?: boolean;
}

/**
 * What one playable chart of a song holds. The song as written and every
 * version each carry their own, fully separate once made.
 */
export interface Chart {
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
  /** Per-section dynamics marks. */
  sectionMarks?: SectionMark[];
  /** Sections the player sits out, anchored like marks. */
  outSections?: SectionRef[];
}

/** The song as written is the top-level chart; versions hold the others. */
export interface Song extends Chart {
  version: 1;
  /** Slug; the export filename is `${id}.json`. */
  id: string;
  title: string;
  artist?: string;
  /** Named versions (double chorus, extended ending), each its own chart. */
  arrangements?: Arrangement[];
  createdAt: string;
  updatedAt: string;
}

export type MarkColor = "red" | "blue" | "amber" | "green";
export type MarkKind = "tacet" | "soft" | "build" | "full" | "custom";

/**
 * A dynamics mark on one section, anchored by the label line's exact text
 * and its occurrence among identical labels, so line edits never shift it.
 */
/** A section by its label line and which of the identical labels it is. */
export interface SectionRef {
  section: string;
  occurrence: number;
}

export interface SectionMark {
  section: string;
  occurrence: number;
  kind: MarkKind;
  /** Custom marks only: a short word shown in place of the preset name. */
  text?: string;
  /** Custom marks only; presets carry fixed colors. */
  color?: MarkColor;
}

/** A mark's look without its anchor. */
export type MarkStyle = Pick<SectionMark, "kind" | "text" | "color">;

/**
 * A named version of the song for a service ("Aug 23 version"). A version is
 * a complete chart of its own: it starts as a copy of the chart it was made
 * from and shares nothing with it afterward.
 */
export interface Arrangement extends Chart {
  /** Slug, unique within the song. */
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SetEntry {
  songId: string;
  /** Which version to play; absent means the song as written. */
  arrangementId?: string;
}

export interface Setlist {
  version: 1;
  /** Slug from the name; setlists sync as one setlists.json file. */
  id: string;
  name: string;
  /** Ordered; a song may appear more than once. */
  entries: SetEntry[];
  createdAt: string;
  updatedAt: string;
}
