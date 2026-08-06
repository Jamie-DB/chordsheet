/**
 * Maintenance sweep over songs/*.json: strip page artifacts, convert
 * chord rows stuck as lyric text into real placements, normalize section
 * spacing. Runs the same functions the app's load-time migration uses, so
 * browser and disk copies transform identically. updatedAt is untouched.
 *
 * Run with: npm run repair-songs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSections, stripPageLines } from "../src/client/lib/normalize";
import { repairChordTextLines } from "../src/client/lib/tabPaste";
import type { Song } from "../src/shared/types";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "songs");

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const path = join(DIR, file);
  const original = readFileSync(path, "utf8");
  const song = JSON.parse(original) as Song;

  const stripped = stripPageLines(song.lyrics, song.placements);
  const repaired = repairChordTextLines(stripped.lyrics, stripped.placements);
  const n = normalizeSections(repaired.lyrics, repaired.placements);
  const cleaned: Song = { ...song, lyrics: n.lyrics, placements: n.placements };

  const next = JSON.stringify(cleaned, null, 2) + "\n";
  if (next !== original) {
    writeFileSync(path, next);
    console.log(
      `${file}: ${repaired.converted} chord-text line(s) converted, ` +
        `placements ${song.placements.length} -> ${cleaned.placements.length}, ` +
        `lines ${song.lyrics.length} -> ${cleaned.lyrics.length}`,
    );
  }
}
console.log("done");
