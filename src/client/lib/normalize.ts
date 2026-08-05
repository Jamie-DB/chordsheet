import type { ChordPlacement } from "../../shared/types";

export interface Normalized {
  lyrics: string[];
  placements: ChordPlacement[];
  changed: boolean;
}

/**
 * Sections are separated by exactly one blank line, no matter what was
 * pasted: runs of blanks collapse, leading and trailing blanks go away.
 * A blank line that carries placements (a standalone instrumental chord
 * row) is content and is never collapsed. Placement line indices remap.
 */
export function normalizeSections(lyrics: string[], placements: ChordPlacement[]): Normalized {
  const linesWithChords = new Set(placements.map((p) => p.line));
  const map = new Map<number, number>();
  const out: string[] = [];
  let pendingBlank = false;

  lyrics.forEach((line, i) => {
    const blank = line.trim() === "" && !linesWithChords.has(i);
    if (blank) {
      pendingBlank = true;
      return;
    }
    if (pendingBlank && out.length > 0) out.push("");
    pendingBlank = false;
    map.set(i, out.length);
    out.push(line);
  });

  const remapped = placements.map((p) => {
    const line = map.get(p.line);
    return line === undefined || line === p.line ? p : { ...p, line };
  });

  const changed =
    out.length !== lyrics.length ||
    out.some((l, i) => l !== lyrics[i]) ||
    remapped.some((p, i) => p !== placements[i]);
  return { lyrics: out, placements: remapped, changed };
}
