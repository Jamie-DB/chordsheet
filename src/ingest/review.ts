import { buildChordRow } from "../engine/layout";
import type { Song } from "../shared/types";

/** Chord rows over numbered lyric lines, for proofreading an ingest against the chart. */
export function previewLines(song: Song): string[] {
  const out: string[] = [];
  song.lyrics.forEach((line, i) => {
    const here = song.placements.filter((p) => p.line === i);
    if (here.length > 0) out.push("    " + buildChordRow(here));
    out.push(String(i).padStart(3) + " " + line);
  });
  return out;
}

/** Log entries with repeats folded into a count, in first-seen order. */
export function groupLog(log: string[]): { entry: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of log) counts.set(entry, (counts.get(entry) ?? 0) + 1);
  return [...counts].map(([entry, count]) => ({ entry, count }));
}
