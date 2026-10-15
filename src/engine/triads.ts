import { chordFamily, parseChord } from "./chord";
import { parseKeyName } from "./key";
import { mod12 } from "./notes";
import { toVoicing, type ShapeResult } from "./shapes";

/**
 * Triad diagrams on the top four strings, for playing three-note shapes
 * instead of full chords. Every chord reduces to its triad (C#m7 to C#m,
 * Fmaj7 to F), and each song's shapes stay near one spot on the neck: the
 * one voicing per chord that sits closest to the song's key chord.
 */

const X = -1;
/** Open pitch class of each string, low E to high E. */
const OPEN_PCS = [4, 9, 2, 7, 11, 4];
/** The adjacent three-string sets inside the top four, G-B-E first so it wins ties. */
const STRING_SETS = [
  [3, 4, 5],
  [2, 3, 4],
];
const MAX_FRET = 15;
/** Widest stretch, in frets, counting an open string as fret 0. */
const MAX_SPAN = 3;

export interface Triad {
  /** Quality suffix of the triad played, e.g. "m" or "sus4". */
  suffix: string;
  /** Chord tones as semitones above the root. */
  intervals: number[];
}

/** The three-note chord a quality reduces to. */
export function triadOf(quality: string): Triad {
  if (quality === "5") return { suffix: "5", intervals: [0, 7] };
  if (chordFamily(quality) === "diminished") return { suffix: "dim", intervals: [0, 3, 6] };
  if (/aug|\+|#5/.test(quality)) return { suffix: "aug", intervals: [0, 4, 8] };
  if (/^(?:2|add2)$|sus2/.test(quality) && !/sus4/.test(quality)) return { suffix: "sus2", intervals: [0, 2, 7] };
  if (/sus/.test(quality)) return { suffix: "sus4", intervals: [0, 5, 7] };
  if (chordFamily(quality) === "minor") return { suffix: "m", intervals: [0, 3, 7] };
  return { suffix: "", intervals: [0, 4, 7] };
}

interface Candidate {
  frets: number[];
  /** Average fret; the shape's place on the neck. */
  center: number;
  /** Index into STRING_SETS. */
  set: number;
}

/** Every playable voicing of the tones on three adjacent strings in the top four. */
function candidates(rootPc: number, intervals: number[]): Candidate[] {
  const tones = new Set(intervals.map((i) => mod12(rootPc + i)));
  const out: Candidate[] = [];
  STRING_SETS.forEach((strings, set) => {
    const options = strings.map((s) =>
      Array.from({ length: MAX_FRET + 1 }, (_, f) => f).filter((f) => tones.has(mod12(OPEN_PCS[s] + f))),
    );
    for (const a of options[0]) {
      for (const b of options[1]) {
        for (const c of options[2]) {
          const picked = [a, b, c];
          if (Math.max(...picked) - Math.min(...picked) > MAX_SPAN) continue;
          const sounded = new Set(picked.map((f, i) => mod12(OPEN_PCS[strings[i]] + f)));
          if (sounded.size !== tones.size) continue;
          const frets = [X, X, X, X, X, X];
          picked.forEach((f, i) => (frets[strings[i]] = f));
          out.push({ frets, center: (a + b + c) / 3, set });
        }
      }
    }
  });
  return out;
}

/**
 * Where on the neck a song's triads gather: the average fret of the lowest
 * voicing of its key chord. Unknown keys gather at the nut.
 */
export function triadHome(keyName: string): number {
  const key = parseKeyName(keyName);
  if (!key) return 0;
  const found = candidates(key.tonicPc, key.mode === "minor" ? [0, 3, 7] : [0, 4, 7]);
  return Math.min(...found.map((c) => c.center));
}

/**
 * The triad voicing for a displayed chord symbol, on three adjacent strings
 * of the top four, nearest `home` (see triadHome). Ties go to the G-B-E
 * strings, then lower on the neck. Null only for unparseable symbols.
 */
export function triadVoicingFor(symbol: string, home: number): ShapeResult | null {
  const parsed = parseChord(symbol);
  if (!parsed) return null;
  const triad = triadOf(parsed.quality);
  const best = candidates(parsed.rootPc, triad.intervals).sort(
    (a, b) => Math.abs(a.center - home) - Math.abs(b.center - home) || a.set - b.set || a.center - b.center,
  )[0];
  return {
    voicing: toVoicing(best.frets),
    playedAs: `${parsed.root}${triad.suffix}`,
    approximated: parsed.bass !== undefined || triad.suffix !== parsed.quality,
  };
}
