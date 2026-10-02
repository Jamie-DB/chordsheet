import type { Arrangement, SetEntry, Song } from "../../shared/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 24 version": the name a new version starts with, from the local date. */
export function defaultVersionName(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()} version`;
}

/** The arrangement with this id, or null for the song as written or an unknown id. */
export function findArrangement(song: Song, id: string | null | undefined): Arrangement | null {
  if (id === null || id === undefined) return null;
  return song.arrangements?.find((a) => a.id === id) ?? null;
}

/** "Title (Version name)" for a set entry, plain "Title" as written, null when the song is gone. */
export function entryTitle(songs: Song[], entry: SetEntry | undefined): string | null {
  if (!entry) return null;
  const song = songs.find((s) => s.id === entry.songId);
  if (!song) return null;
  const version = findArrangement(song, entry.arrangementId);
  return version ? `${song.title} (${version.name})` : song.title;
}

/** "1 version", "3 versions". */
export function versionCount(n: number): string {
  return `${n} version${n === 1 ? "" : "s"}`;
}
