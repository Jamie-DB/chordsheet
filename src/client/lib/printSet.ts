import { shapedKey } from "../../engine";
import type { Setlist, Song } from "../../shared/types";
import { chartOf, soundingKeyOf } from "./charts";
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
    // Each version has its own key, capo, and chords.
    const chart = chartOf(written, version?.id);
    const soundingKey = soundingKeyOf(chart);
    sheets.push({
      song: chart,
      soundingKey,
      shapedKeyName: soundingKey ? shapedKey(soundingKey, chart.capo) : "C",
      versionName: version?.name,
    });
  }
  return sheets;
}
