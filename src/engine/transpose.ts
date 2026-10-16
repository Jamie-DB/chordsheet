import { formatChord, parseChord } from "./chord";
import { mod12, type Spelling } from "./notes";

/**
 * Transpose a chord symbol by semitones, respelling for the target context.
 * A chord that does not move keeps its own spelling (a Bb in C stays Bb), so
 * only a real move respells. Symbols that fail to parse are returned
 * unchanged; never throws.
 */
export function transposeSymbol(symbol: string, semitones: number, prefer: Spelling): string {
  const parsed = parseChord(symbol);
  if (!parsed) return symbol;
  if (semitones === 0) return `${parsed.root}${parsed.quality}${parsed.bass ? `/${parsed.bass}` : ""}`;
  return formatChord(
    mod12(parsed.rootPc + semitones),
    parsed.quality,
    parsed.bassPc === undefined ? undefined : mod12(parsed.bassPc + semitones),
    prefer,
  );
}
