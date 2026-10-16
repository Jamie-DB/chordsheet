import { chordFamily, parseChord } from "./chord";
import { parseKeyName } from "./key";
import { mod12 } from "./notes";
import type { ShapeResult } from "./shapes";

/**
 * Triad diagrams for playing three-note shapes instead of full chords, on
 * the D, G, and B strings between the 3rd and 9th frets (Jamie: the low
 * shapes he knows already). Every chord reduces to its triad (C#m7 to C#m,
 * Fmaj7 to F), and a song's shapes walk the neck: each takes the voicing
 * nearest the one before it, starting from the song's key chord.
 */

const X = -1;
/** Open pitch class of each string, low E to high E. */
const OPEN_PCS = [4, 9, 2, 7, 11, 4];
/** D, G, and B, as string indexes. */
const STRINGS = [2, 3, 4];
/** The neck window. Every triad this module plays has a shape inside it (tested). */
const MIN_FRET = 3;
const MAX_FRET = 9;
/** Widest stretch, in frets. */
const MAX_SPAN = 3;

export interface Triad {
  /** Quality suffix of the triad played, e.g. "m" or "sus4". */
  suffix: string;
  /** Chord tones as semitones above the root. */
  intervals: number[];
}

/**
 * The three-note chord a quality reduces to. A 5 chord plays the major
 * triad: root and fifth alone have no shape on D-G-B inside the window.
 */
export function triadOf(quality: string): Triad {
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
}

/** Every playable voicing of the tones on D-G-B inside the window. */
function candidates(rootPc: number, intervals: number[]): Candidate[] {
  const tones = new Set(intervals.map((i) => mod12(rootPc + i)));
  const options = STRINGS.map((s) =>
    Array.from({ length: MAX_FRET - MIN_FRET + 1 }, (_, i) => MIN_FRET + i).filter((f) =>
      tones.has(mod12(OPEN_PCS[s] + f)),
    ),
  );
  const out: Candidate[] = [];
  for (const a of options[0]) {
    for (const b of options[1]) {
      for (const c of options[2]) {
        const picked = [a, b, c];
        if (Math.max(...picked) - Math.min(...picked) > MAX_SPAN) continue;
        const sounded = new Set(picked.map((f, i) => mod12(OPEN_PCS[STRINGS[i]] + f)));
        if (sounded.size !== tones.size) continue;
        const frets = [X, X, X, X, X, X];
        picked.forEach((f, i) => (frets[STRINGS[i]] = f));
        out.push({ frets, center: (a + b + c) / 3 });
      }
    }
  }
  return out;
}

/**
 * Where a song's triads start: the average fret of its key chord at the
 * highest spot in the window (C at 5-5-5, E at 9-9-9). Unknown keys start
 * at the window's middle.
 */
export function triadHome(keyName: string): number {
  const key = parseKeyName(keyName);
  if (!key) return 6;
  const found = candidates(key.tonicPc, key.mode === "minor" ? [0, 3, 7] : [0, 4, 7]);
  return Math.max(...found.map((c) => c.center));
}

/**
 * The triad voicing for a displayed chord symbol on D-G-B, nearest `near`
 * (the previous chord's place, or triadHome for the first), lower on the
 * neck on a tie. Null only for unparseable symbols.
 */
export function triadVoicingFor(symbol: string, near: number): (ShapeResult & { center: number }) | null {
  const parsed = parseChord(symbol);
  if (!parsed) return null;
  const triad = triadOf(parsed.quality);
  const best = candidates(parsed.rootPc, triad.intervals).sort(
    (a, b) => Math.abs(a.center - near) - Math.abs(b.center - near) || a.center - b.center,
  )[0];
  return {
    // The grid starts at the shape's lowest fret, so a 3rd-fret shape never reads as open.
    voicing: { frets: best.frets, baseFret: Math.min(...best.frets.filter((f) => f > 0)) },
    playedAs: `${parsed.root}${triad.suffix}`,
    approximated: parsed.bass !== undefined || triad.suffix !== parsed.quality,
    center: best.center,
  };
}
