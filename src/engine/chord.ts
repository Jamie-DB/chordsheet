import { mod12, noteToPc, pcToName, type Spelling } from "./notes";

export interface ParsedChord {
  /** Root note as written, e.g. "Bb". */
  root: string;
  rootPc: number;
  /** Normalized quality suffix; "" means a plain major triad. */
  quality: string;
  bass?: string;
  bassPc?: number;
}

/** Qualities with first-class support across the engine. */
const KNOWN_QUALITIES = new Set([
  "", "m", "7", "maj7", "m7", "m7b5", "dim", "dim7", "aug",
  "sus2", "sus4", "7sus4", "6", "m6", "9", "m9", "add9", "11", "13", "5",
]);

/** Whole-suffix aliases normalized before lookup. */
const QUALITY_ALIASES: Record<string, string> = {
  M: "", M7: "maj7", Maj7: "maj7", MAJ7: "maj7", "Δ": "maj7", "Δ7": "maj7",
  min: "m", min7: "m7", min6: "m6", min9: "m9", "-": "m", "-7": "m7",
  "+": "aug", o: "dim", "°": "dim", o7: "dim7", "°7": "dim7",
  "ø": "m7b5", "ø7": "m7b5", sus: "sus4",
};

// Tokens that may make up an unknown-but-plausible quality suffix. Anything the
// tokenizer cannot consume (like the "x" in "Cx") makes the symbol invalid.
const SUFFIX_TOKENS = [
  "maj", "min", "dim", "aug", "sus", "add", "alt", "omit", "no",
  "M", "m", "o", "°", "Δ", "ø", "+", "-", "#", "b", "(", ")", "/",
];

function isPlausibleQuality(suffix: string): boolean {
  // The root already absorbed any accidental; a quality may not start with
  // another one. A leading "b" is only valid opening a degree alteration (b5, b9).
  if (suffix.startsWith("#") || /^b(?![0-9])/.test(suffix)) return false;
  let i = 0;
  outer: while (i < suffix.length) {
    const ch = suffix[i];
    if (ch >= "0" && ch <= "9") {
      i += 1;
      continue;
    }
    for (const tok of SUFFIX_TOKENS) {
      if (suffix.startsWith(tok, i)) {
        i += tok.length;
        continue outer;
      }
    }
    return false;
  }
  return true;
}

/**
 * Parse a chord symbol like "Am7", "G/B", "F#m7b5", "Bbmaj7".
 * Known qualities normalize to a canonical form; unknown but plausible
 * suffixes are preserved verbatim so real-world charts still work.
 */
export function parseChord(symbol: string): ParsedChord | null {
  const trimmed = symbol.trim();
  const m = /^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/.exec(trimmed);
  if (!m) return null;

  const rootPc = noteToPc(m[1]);
  if (rootPc === null) return null;

  let quality = m[2] ?? "";
  quality = QUALITY_ALIASES[quality] ?? quality;
  if (!KNOWN_QUALITIES.has(quality) && !isPlausibleQuality(quality)) return null;

  const parsed: ParsedChord = { root: m[1], rootPc, quality };
  if (m[3]) {
    const bassPc = noteToPc(m[3]);
    if (bassPc === null) return null;
    parsed.bass = m[3];
    parsed.bassPc = bassPc;
  }
  return parsed;
}

export function isChordSymbol(s: string): boolean {
  return parseChord(s) !== null;
}

export function formatChord(
  rootPc: number,
  quality: string,
  bassPc: number | undefined,
  prefer: Spelling,
): string {
  const root = pcToName(mod12(rootPc), prefer);
  const bass = bassPc === undefined ? "" : `/${pcToName(mod12(bassPc), prefer)}`;
  return `${root}${quality}${bass}`;
}

export type ChordFamily = "major" | "minor" | "dominant" | "diminished";

/** Coarse classification used by key detection and capo scoring. */
export function chordFamily(quality: string): ChordFamily {
  if (quality === "dim" || quality === "dim7" || quality === "m7b5") return "diminished";
  if (/^m(?!aj)/.test(quality)) return "minor";
  if (/^(7|9|11|13|7sus4)$/.test(quality)) return "dominant";
  return "major";
}
