import { chordFamily, parseChord } from "./chord";
import { keyPrefersFlat, transposeKeyName } from "./key";
import { transposeSymbol } from "./transpose";

/** The key whose shapes the hands play: sounding key moved down by the capo. */
export function shapedKey(soundingKeyName: string, capo: number): string {
  return transposeKeyName(soundingKeyName, -capo);
}

/**
 * What the sheet shows for a stored (sounding) chord at a given capo.
 * Spelling follows the shaped key. At capo 0 this is just a respell.
 */
export function displayChord(soundingSymbol: string, capo: number, shapedKeyName: string): string {
  const prefer = keyPrefersFlat(shapedKeyName) ? "flat" : "sharp";
  return transposeSymbol(soundingSymbol, -capo, prefer);
}

/**
 * Entry while capo > 0 happens in shape space (you type what you see).
 * Converts the typed shape up to the sounding chord for storage.
 */
export function soundingFromShape(shapeSymbol: string, capo: number, soundingKeyName: string): string {
  const prefer = keyPrefersFlat(soundingKeyName) ? "flat" : "sharp";
  return transposeSymbol(shapeSymbol, capo, prefer);
}

// Open-chord friendliness. Root pitch classes with comfortable open shapes.
const OPEN_MAJOR_ROOTS = new Set([0, 9, 7, 4, 2]); // C A G E D
const OPEN_MINOR_ROOTS = new Set([9, 4, 2]);       // Am Em Dm

function scoreShape(shapeSymbol: string): number {
  const parsed = parseChord(shapeSymbol);
  if (!parsed) return 0;
  const family = chordFamily(parsed.quality);
  if (family === "minor" && OPEN_MINOR_ROOTS.has(parsed.rootPc)) return 3;
  if ((family === "major" || family === "dominant") && OPEN_MAJOR_ROOTS.has(parsed.rootPc)) return 3;
  if (parsed.rootPc === 11 && parsed.quality === "7") return 3; // B7, the classic open exception
  return -1; // barre or awkward territory
}

export function scoreCapoFret(soundingSymbols: string[], fret: number): number {
  let total = 0;
  for (const symbol of soundingSymbols) {
    total += scoreShape(transposeSymbol(symbol, -fret, "sharp"));
  }
  // Slight preference for lower positions among comparable scores.
  return total - fret * 0.5;
}

export interface CapoSuggestion {
  fret: number;
  score: number;
  shapedKeyName: string;
  /** Unique display shapes in first-appearance order. */
  shapes: string[];
}

export function suggestCapo(soundingSymbols: string[], soundingKeyName: string): CapoSuggestion[] {
  const suggestions: CapoSuggestion[] = [];
  for (let fret = 0; fret <= 9; fret++) {
    const shapedKeyName = shapedKey(soundingKeyName, fret);
    const shapes: string[] = [];
    for (const symbol of soundingSymbols) {
      const shape = displayChord(symbol, fret, shapedKeyName);
      if (!shapes.includes(shape)) shapes.push(shape);
    }
    suggestions.push({ fret, score: scoreCapoFret(soundingSymbols, fret), shapedKeyName, shapes });
  }
  return suggestions.sort((a, b) => b.score - a.score || a.fret - b.fret);
}
