import type { ChordPlacement } from "../../shared/types";

/** One printed row pair of a wrapped line: lyric text plus its chords. */
export interface WrappedRow {
  lyric: string;
  /** Continuation rows carry their indent as leading spaces. */
  placements: ChordPlacement[];
}

/**
 * Split one lyric line and its chords into rows no wider than `width`, so a
 * long line wraps inside a two-column layout instead of ruling it out. Rows
 * after the first are indented by `indent` columns. Breaks fall after a space
 * where possible and never through a chord symbol. Chords keep the column
 * they sit at relative to the text, collisions included, so a chord stays
 * over the same letters.
 *
 * `render` gives each chord's printed text, which sets how wide it is.
 */
export function wrapLine(
  lyric: string,
  placements: ChordPlacement[],
  render: (chord: string, hold: boolean) => string,
  width: number,
  indent = 2,
): WrappedRow[] {
  // Where each chord actually lands: a collision pushes it right of the
  // previous symbol, exactly as buildChordRowSegments lays it out.
  const laid: { placement: ChordPlacement; start: number; end: number }[] = [];
  let length = 0;
  for (const p of [...placements].sort((a, b) => a.col - b.col)) {
    const text = render(p.chord, p.hold === true);
    if (text.length === 0) continue;
    const start = laid.length === 0 ? Math.max(0, p.col) : Math.max(p.col, length + 1);
    length = start + text.length;
    laid.push({ placement: p, start, end: length });
  }

  const total = Math.max(lyric.length, length);
  const rows: WrappedRow[] = [];
  let from = 0;
  while (true) {
    const lead = rows.length === 0 ? 0 : indent;
    const room = width - lead;
    const to = total - from <= room ? total : breakAt(lyric, laid, from, from + room);
    const text = lyric.slice(from, to).trimEnd();
    const chords = laid.filter((c) => c.start >= from && c.start < to);
    // A tail of nothing but spaces would print as an empty row.
    if (rows.length === 0 || text.length > 0 || chords.length > 0) {
      rows.push({
        lyric: text.length > 0 || rows.length === 0 ? " ".repeat(lead) + text : "",
        placements: chords.map((c) => ({ ...c.placement, col: c.start - from + lead })),
      });
    }
    if (to >= total) return rows;
    from = to;
  }
}

/** The best column in (from, limit] to start the next row at. */
function breakAt(
  lyric: string,
  laid: { start: number; end: number }[],
  from: number,
  limit: number,
): number {
  const splitsChord = (b: number) => laid.some((c) => c.start < b && b < c.end);
  let hard = 0;
  for (let b = limit; b > from; b--) {
    if (splitsChord(b)) continue;
    // After a space, or out past the lyric where only chords remain.
    if (b >= lyric.length || lyric[b - 1] === " ") return b;
    if (hard === 0) hard = b;
  }
  return hard || limit;
}
