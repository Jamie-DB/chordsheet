/**
 * Maintenance sweep over songs/*.json: strip page artifacts, convert
 * chord rows stuck as lyric text into real placements, normalize section
 * spacing. Runs the same cleanSong the app's load-time migration uses, so
 * browser and disk copies transform identically. updatedAt is untouched.
 *
 * Run with: npm run repair-songs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanSong } from "../src/client/lib/cleanSong";
import type { Song } from "../src/shared/types";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "songs");

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const path = join(DIR, file);
  const original = readFileSync(path, "utf8");
  const song = JSON.parse(original) as Song;
  if (!Array.isArray(song.lyrics)) {
    // Not a song (setlists.json lives here too); leave it alone.
    continue;
  }

  const { song: cleaned, chordLinesConverted, labelNotesPromoted } = cleanSong(song);

  const next = JSON.stringify(cleaned, null, 2) + "\n";
  if (next !== original) {
    writeFileSync(path, next);
    console.log(
      `${file}: ${chordLinesConverted} chord-text line(s), ` +
        `${labelNotesPromoted} label note(s) promoted, ` +
        `placements ${song.placements.length} -> ${cleaned.placements.length}, ` +
        `lines ${song.lyrics.length} -> ${cleaned.lyrics.length}`,
    );
  }
}
console.log("done");
