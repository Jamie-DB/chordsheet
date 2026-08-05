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
  out.push("");

  song.lyrics.forEach((line, i) => {
    const row = buildChordRow(
      song.placements.filter((p) => p.line === i),
      (chord) => displayChord(chord, song.capo, shapedKeyName),
    );
    if (row.length > 0) out.push(row);
    out.push(line);
  });
  return out.join("\n") + "\n";
}
