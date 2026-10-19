/**
 * ASCII guitar tab: six staff lines such as `e|---0-2---|`, high e on top.
 * Fret numbers are the only thing that moves with a key change or a capo;
 * technique letters, bar lines, and any non-staff line pass through as text.
 */

/** A string name, optional accidental, then the staff's opening bar. */
const STAFF = /^\s*[a-gA-G][#b]?\s*\|/;

/** Highest fret a shifted riff may reach before it drops an octave. */
const MAX_FRET = 24;

export function isStaffLine(line: string): boolean {
  return STAFF.test(line);
}

interface FretRun {
  line: number;
  start: number;
  end: number;
  fret: number;
}

/** Every fret number on a staff line, past the string name and opening bar. */
function fretRuns(lines: string[]): FretRun[] {
  const runs: FretRun[] = [];
  lines.forEach((line, i) => {
    if (!isStaffLine(line)) return;
    const body = line.indexOf("|") + 1;
    for (const m of line.slice(body).matchAll(/\d+/g)) {
      const start = body + (m.index ?? 0);
      runs.push({ line: i, start, end: start + m[0].length, fret: Number(m[0]) });
    }
  });
  return runs;
}

/** The lowest fret the tab uses, or null when it has no staff notes. */
export function lowestFret(lines: string[]): number | null {
  const runs = fretRuns(lines);
  return runs.length === 0 ? null : Math.min(...runs.map((r) => r.fret));
}

/**
 * Move every fret by `semitones`. When a note would fall below the nut the
 * whole tab moves up an octave, and when one would pass fret 24 it moves
 * down one, so the riff keeps its shape on the same strings.
 *
 * Numbers that sit in the same columns across strings (a chord, or notes
 * struck together) form one column group. A group is redrawn as wide as its
 * widest new number, so a 9 that becomes 11 widens the column on all six
 * strings and the staff stays aligned.
 */
export function shiftTab(lines: string[], semitones: number): string[] {
  const runs = fretRuns(lines);
  if (runs.length === 0 || semitones === 0) return lines;
  let shift = semitones;
  const lo = Math.min(...runs.map((r) => r.fret)) + shift;
  const hi = Math.max(...runs.map((r) => r.fret)) + shift;
  if (lo < 0) shift += 12 * Math.ceil(-lo / 12);
  else if (hi > MAX_FRET && lo >= 12) shift -= 12;

  // Column groups: runs whose column spans overlap, swept left to right.
  const sorted = [...runs].sort((a, b) => a.start - b.start);
  const groups: { start: number; end: number; runs: FretRun[] }[] = [];
  for (const run of sorted) {
    const last = groups[groups.length - 1];
    if (last && run.start < last.end) {
      last.end = Math.max(last.end, run.end);
      last.runs.push(run);
    } else {
      groups.push({ start: run.start, end: run.end, runs: [run] });
    }
  }

  const staffLines = new Set(runs.map((r) => r.line));
  lines.forEach((line, i) => {
    if (isStaffLine(line)) staffLines.add(i);
  });

  const out = [...lines];
  // Right to left, so earlier columns keep their offsets while later ones change width.
  for (const group of [...groups].reverse()) {
    const pieces = new Map<number, string>();
    for (const i of staffLines) {
      const line = lines[i];
      let piece = "";
      let pos = group.start;
      for (const run of group.runs.filter((r) => r.line === i).sort((a, b) => a.start - b.start)) {
        piece += line.slice(pos, run.start) + String(run.fret + shift);
        pos = run.end;
      }
      piece += line.slice(pos, group.end);
      pieces.set(i, piece);
    }
    // The notes set the width. A string with no note here only narrows by
    // dropping filler, never a letter or bar.
    const noted = new Set(group.runs.map((r) => r.line));
    let width = Math.max(...[...pieces].filter(([i]) => noted.has(i)).map(([, p]) => p.length));
    for (const [i, piece] of pieces) {
      if (!noted.has(i) && /[^-]/.test(piece.slice(width))) width = Math.max(width, piece.length);
    }
    for (const [i, piece] of pieces) {
      const line = out[i];
      out[i] = line.slice(0, group.start) + piece.slice(0, width).padEnd(width, "-") + line.slice(group.end);
    }
  }
  return out;
}

/** Where the left hand sits: "open position" or "fret 5". Null without notes. */
export function positionLabel(lines: string[]): string | null {
  const lo = lowestFret(lines);
  if (lo === null) return null;
  return lo === 0 ? "open position" : `fret ${lo}`;
}
