import { detectKey, shapedKey } from "../../engine";
import type { Setlist, Song } from "../../shared/types";
import { renderArrangement } from "./arrangement";
import { findArrangement } from "./versions";

/** One set entry resolved to what PrintSheet needs. */
export interface SetSheet {
  song: Song;
  soundingKey: string | null;
  shapedKeyName: string;
  versionName?: string;
}

/**
 * The songs of a set in order, each in the version the set plays. Entries
 * whose song is gone are skipped, as the set list does.
 */
export function setSheets(set: Setlist, songs: Song[]): SetSheet[] {
  const byId = new Map(songs.map((s) => [s.id, s]));
  const sheets: SetSheet[] = [];
  for (const entry of set.entries) {
    const written = byId.get(entry.songId);
    if (!written) continue;
    const version = findArrangement(written, entry.arrangementId);
    // Key detection reads the song as written, like the editor does.
    const soundingKey = written.keyOverride ?? detectKey(written.placements.map((p) => p.chord))?.name ?? null;
    sheets.push({
      song: version ? renderArrangement(written, version).song : written,
      soundingKey,
      shapedKeyName: soundingKey ? shapedKey(soundingKey, written.capo) : "C",
      versionName: version?.name,
    });
  }
  return sheets;
}
