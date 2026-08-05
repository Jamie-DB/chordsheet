export interface ChordPlacement {
  id: string;
  line: number;
  col: number;
  /** Canonical SOUNDING chord symbol, e.g. "Bbmaj7", "G/B", "F#m7". */
  chord: string;
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
