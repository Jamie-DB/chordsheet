import { buildChordRow, displayChord } from "../../engine";
import type { Song } from "../../shared/types";

/**
 * Plain-text rendering of the sheet, identical to print by construction
 * (both interleave buildChordRow output with lyric lines).
 */
export function sheetText(song: Song, soundingKey: string | null, shapedKeyName: string): string {
  const out: string[] = [song.title];
  if (song.artist) out.push(song.artist);
  const keyBits: string[] = [];
  if (soundingKey) keyBits.push(`Key: ${soundingKey}`);
  if (song.capo > 0) keyBits.push(`Capo ${song.capo}`);
  if (keyBits.length > 0) out.push(keyBits.join(", "));
  if (song.notes?.trim()) out.push(...song.notes.trim().split("\n"));
  out.push("");

  song.lyrics.forEach((line, i) => {
    // Holds print as <C>, the ASCII form of the diamond; the opening bracket
    // borrows the column to the left so the chord letter stays put.
    const linePlacements = song.placements
      .filter((p) => p.line === i)
      .map((p) => (p.hold ? { ...p, col: Math.max(0, p.col - 1) } : p));
    const row = buildChordRow(linePlacements, (chord, hold) => {
      const display = displayChord(chord, song.capo, shapedKeyName);
      return hold ? `<${display}>` : display;
    });
    if (row.length > 0) out.push(row);
    out.push(line);
  });
  return out.join("\n") + "\n";
}
