import { chordFamily, parseChord, type ChordFamily } from "./chord";
import { mod12, noteToPc, pcToName } from "./notes";

export type Mode = "major" | "minor";

export interface KeyGuess {
  tonicPc: number;
  mode: Mode;
  /** Canonical name, e.g. "Eb" or "F#m". */
  name: string;
  /** 0..1; margin of the best key over the runner-up. */
  confidence: number;
}

export function parseKeyName(name: string): { tonicPc: number; mode: Mode } | null {
  const m = /^([A-G](?:#|b)?)(m)?$/.exec(name.trim());
  if (!m) return null;
  const tonicPc = noteToPc(m[1]);
  if (tonicPc === null) return null;
  return { tonicPc, mode: m[2] ? "minor" : "major" };
}

// Conventional key signatures: which tonics spell flat.
const FLAT_MAJOR_TONICS = new Set([5, 10, 3, 8, 1]);        // F Bb Eb Ab Db
const FLAT_MINOR_TONICS = new Set([2, 7, 0, 5, 10, 3]);     // Dm Gm Cm Fm Bbm Ebm

export function keyPrefersFlat(keyName: string): boolean {
  const k = parseKeyName(keyName);
  if (!k) return false;
  return k.mode === "major" ? FLAT_MAJOR_TONICS.has(k.tonicPc) : FLAT_MINOR_TONICS.has(k.tonicPc);
}

export function keyName(tonicPc: number, mode: Mode): string {
  const flat = mode === "major" ? FLAT_MAJOR_TONICS.has(mod12(tonicPc)) : FLAT_MINOR_TONICS.has(mod12(tonicPc));
  return pcToName(tonicPc, flat ? "flat" : "sharp") + (mode === "minor" ? "m" : "");
}

export function transposeKeyName(name: string, semitones: number): string {
  const k = parseKeyName(name);
  if (!k) return name;
  return keyName(mod12(k.tonicPc + semitones), k.mode);
}

// Scale degrees as [interval from tonic, expected triad family].
// Minor includes the harmonic-minor dominant (major/dominant on degree 5).
const MAJOR_DEGREES: Array<[number, ChordFamily[]]> = [
  [0, ["major"]], [2, ["minor"]], [4, ["minor"]], [5, ["major"]],
  [7, ["major", "dominant"]], [9, ["minor"]], [11, ["diminished"]],
];
const MINOR_DEGREES: Array<[number, ChordFamily[]]> = [
  [0, ["minor"]], [2, ["diminished"]], [3, ["major"]], [5, ["minor"]],
  [7, ["minor", "major", "dominant"]], [8, ["major"]], [10, ["major", "dominant"]],
];

/**
 * Score all 24 keys against the placed chords, in placement order.
 * Diatonic triad match +3, root merely in scale +1, first and last chord
 * on the tonic +3 each, a dominant-family chord on the fifth +1.
 */
export function detectKey(symbols: string[]): KeyGuess | null {
  const chords = symbols
    .map((s) => parseChord(s))
    .filter((c): c is NonNullable<typeof c> => c !== null);
  if (chords.length === 0) return null;

  let best: { tonicPc: number; mode: Mode; score: number } | null = null;
  let second = -Infinity;

  for (const mode of ["major", "minor"] as const) {
    const degrees = mode === "major" ? MAJOR_DEGREES : MINOR_DEGREES;
    for (let tonicPc = 0; tonicPc < 12; tonicPc++) {
      let score = 0;
      let hasDominant = false;
      for (const chord of chords) {
        const interval = mod12(chord.rootPc - tonicPc);
        const family = chordFamily(chord.quality);
        const degree = degrees.find(([iv]) => iv === interval);
        if (degree) {
          score += degree[1].includes(family) ? 3 : 1;
          if (interval === 7 && (family === "dominant" || family === "major")) hasDominant = true;
        }
      }
      const tonicFamily: ChordFamily = mode === "major" ? "major" : "minor";
      const first = chords[0];
      const last = chords[chords.length - 1];
      if (mod12(first.rootPc - tonicPc) === 0 && chordFamily(first.quality) === tonicFamily) score += 3;
      if (mod12(last.rootPc - tonicPc) === 0 && chordFamily(last.quality) === tonicFamily) score += 3;
      if (hasDominant) score += 1;

      // Ties break toward major, then toward the earlier (lower pc) tonic.
      if (!best || score > best.score) {
        if (best) second = Math.max(second, best.score);
        best = { tonicPc, mode, score };
      } else {
        second = Math.max(second, score);
      }
    }
  }

  if (!best || best.score <= 0) return null;
  const confidence = second <= 0 ? 1 : Math.max(0, Math.min(1, (best.score - second) / best.score));
  return { tonicPc: best.tonicPc, mode: best.mode, name: keyName(best.tonicPc, best.mode), confidence };
}
