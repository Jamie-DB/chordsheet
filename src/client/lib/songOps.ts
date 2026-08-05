import { keyPrefersFlat, transposeKeyName, transposeSymbol } from "../../engine";
import type { Song } from "../../shared/types";

/** Rewrite every stored sounding chord: a real key change. Capo is untouched. */
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
  };
}
