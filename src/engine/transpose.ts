import { formatChord, parseChord } from "./chord";
import { mod12, type Spelling } from "./notes";

/**
 * Transpose a chord symbol by semitones, respelling for the target context.
 * Symbols that fail to parse are returned unchanged; never throws.
 */
export function transposeSymbol(symbol: string, semitones: number, prefer: Spelling): string {
  const parsed = parseChord(symbol);
  if (!parsed) return symbol;
  return formatChord(
    mod12(parsed.rootPc + semitones),
    parsed.quality,
    parsed.bassPc === undefined ? undefined : mod12(parsed.bassPc + semitones),
    prefer,
  );
}
