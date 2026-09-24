import { buildChordRow, displayChord } from "../../engine";
import type { Song } from "../../shared/types";

/**
 * The header's key line, e.g. "Key: Eb, Capo 3". The key shown is always the
 * sounding key. Empty when there is neither a key nor a capo.
 */
export function headerKeyLine(soundingKey: string | null, capo: number): string {
  const bits: string[] = [];
  if (soundingKey) bits.push(`Key: ${soundingKey}`);
  if (capo > 0) bits.push(`Capo ${capo}`);
  return bits.join(", ");
}

/**
 * Plain-text rendering of the sheet. Chord and lyric rows match print because
 * both come from buildChordRow, but section labels stay as bracketed lyric
 * lines, holds render as <C>, and dynamics marks and chord diagrams are left out.
 * A version's name gets its own line under the title and artist.
 */
export function sheetText(
  song: Song,
  soundingKey: string | null,
  shapedKeyName: string,
  versionName?: string,
): string {
  const out: string[] = [song.title];
  if (song.artist) out.push(song.artist);
  if (versionName?.trim()) out.push(versionName.trim());
  const keyLine = headerKeyLine(soundingKey, song.capo);
  if (keyLine) out.push(keyLine);
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
