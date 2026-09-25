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
  /** Per-section dynamics marks for the song as written. */
  sectionMarks?: SectionMark[];
  /**
   * Sections the player sits out, anchored like marks. Set only on a
   * rendered version (from its steps), never on a stored song.
   */
  outSections?: SectionRef[];
  /** Named playing versions (double chorus, extended ending) over these sections. */
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

/** A mark's look without its anchor; arrangement steps carry their own. */
export type MarkStyle = Pick<SectionMark, "kind" | "text" | "color">;

/**
 * One block of an arrangement: a section of the song, found the same way
 * section marks are (label line text plus occurrence). OPENING ("") names
 * the unlabeled lines above the first label.
 */
export interface ArrangementStep {
  section: string;
  occurrence: number;
  /** Played this many times, printed once as "x3"; absent means once. */
  repeat?: number;
  /** Cue printed under the label, e.g. "vamp while the pastor speaks". */
  note?: string;
  /** Overrides the section's own mark; null clears it for this step. */
  mark?: MarkStyle | null;
  /** The player sits this step out: it prints small under an OUT stamp. */
  out?: boolean;
}

/**
 * A named version of the song for a service ("Aug 23 version"). Words and
 * chords stay in the song; the arrangement only orders its sections.
 */
export interface Arrangement {
  /** Slug, unique within the song. */
  id: string;
  name: string;
  steps: ArrangementStep[];
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
