import type { ChordPlacement } from "../shared/types";

export interface ChordRowSegment {
  text: string;
  /** True on chord segments marked as full-measure holds (diamonds). */
  hold: boolean;
}

/**
 * Build the chord row as ordered segments (space gaps and chord symbols),
 * so HTML contexts can style hold chords without disturbing the literal
 * text layout. Chords land at their column; collisions shift right, keeping
 * at least one space between adjacent symbols. A chord past the end of the
 * lyric just extends the row.
 */
export function buildChordRowSegments(
  placements: ChordPlacement[],
  render: (chord: string, hold: boolean) => string = (c) => c,
): ChordRowSegment[] {
  const sorted = [...placements].sort((a, b) => a.col - b.col);
  const segments: ChordRowSegment[] = [];
  let length = 0;
  for (const p of sorted) {
    const hold = p.hold === true;
    const symbol = render(p.chord, hold);
    if (symbol.length === 0) continue;
    const start = length === 0 ? Math.max(0, p.col) : Math.max(p.col, length + 1);
    if (start > length) {
      segments.push({ text: " ".repeat(start - length), hold: false });
      length = start;
    }
    segments.push({ text: symbol, hold });
    length += symbol.length;
  }
  return segments;
}

/** The literal chord text row above a lyric line in print and text export. */
export function buildChordRow(
  placements: ChordPlacement[],
  render: (chord: string, hold: boolean) => string = (c) => c,
): string {
  return buildChordRowSegments(placements, render)
    .map((s) => s.text)
    .join("");
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
