import type { ChordPlacement } from "../shared/types";

/**
 * Build the literal chord text row that sits above a lyric line in print and
 * plain-text export. Chords land at their column; collisions shift right,
 * keeping at least one space between adjacent symbols. Never throws, never
 * truncates; a chord past the end of the lyric just extends the row.
 */
export function buildChordRow(
  placements: ChordPlacement[],
  render: (chord: string) => string = (c) => c,
): string {
  const sorted = [...placements].sort((a, b) => a.col - b.col);
  let row = "";
  for (const p of sorted) {
    const symbol = render(p.chord);
    if (symbol.length === 0) continue;
    const start = row.length === 0 ? Math.max(0, p.col) : Math.max(p.col, row.length + 1);
    row = row + " ".repeat(start - row.length) + symbol;
  }
  return row;
}

/**
 * Resolve an anchor substring to a column in a lyric line.
 * Tries the nth exact occurrence, then case-insensitive, then the anchor's
 * first word. Returns null when nothing matches; callers surface that.
 */
export function resolveAnchor(
  line: string,
  anchor: string,
  occurrence: number = 1,
  offset: number = 0,
): number | null {
  const target = anchor.trim();
  if (target.length === 0) return null;

  const nth = (haystack: string, needle: string, n: number): number => {
    let idx = -1;
    for (let i = 0; i < n; i++) {
      idx = haystack.indexOf(needle, idx + 1);
      if (idx === -1) return -1;
    }
    return idx;
  };

  let found = nth(line, target, Math.max(1, occurrence));
  if (found === -1) found = nth(line.toLowerCase(), target.toLowerCase(), Math.max(1, occurrence));
  if (found === -1) {
    const firstWord = target.split(/\s+/)[0];
    if (firstWord && firstWord !== target) {
      found = nth(line, firstWord, 1);
      if (found === -1) found = nth(line.toLowerCase(), firstWord.toLowerCase(), 1);
    }
  }
  if (found === -1) return null;

  return Math.max(0, Math.min(line.length, found + Math.max(0, offset)));
}
