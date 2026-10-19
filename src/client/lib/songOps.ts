import { keyPrefersFlat, shiftTab, transposeKeyName, transposeSymbol } from "../../engine";
import type { Song } from "../../shared/types";

/** Rewrite every stored sounding chord and riff fret: a real key change. Capo is untouched. */
export function transposeSong(song: Song, soundingKey: string | null, semitones: number): Song {
  const newKey = soundingKey ? transposeKeyName(soundingKey, semitones) : null;
  const prefer = newKey && keyPrefersFlat(newKey) ? "flat" : "sharp";
  return {
    ...song,
    keyOverride: song.keyOverride ? transposeKeyName(song.keyOverride, semitones) : null,
    placements: song.placements.map((p) => ({
      ...p,
      chord: transposeSymbol(p.chord, semitones, prefer),
    })),
    ...(song.riffs ? { riffs: song.riffs.map((r) => ({ ...r, tab: shiftTab(r.tab, semitones) })) } : {}),
  };
}
