import type { Song } from "../../shared/types";

/** Case-insensitive substring match over title and artist only (by Jamie's choice). */
export function matchesQuery(song: Song, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return true;
  return song.title.toLowerCase().includes(q) || (song.artist ?? "").toLowerCase().includes(q);
}

export type SortKey = "title" | "artist" | "updated" | "created";

const byTitle = (a: Song, b: Song): number =>
  a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id);

// Songs without an artist sort after those with one.
const ARTIST_LAST = "￿";

export const SORTS: Record<SortKey, { label: string; compare(a: Song, b: Song): number }> = {
  title: { label: "Title", compare: byTitle },
  artist: {
    label: "Artist",
    compare: (a, b) =>
      (a.artist ?? ARTIST_LAST).localeCompare(b.artist ?? ARTIST_LAST, undefined, {
        sensitivity: "base",
      }) || byTitle(a, b),
  },
  updated: {
    label: "Recently updated",
    compare: (a, b) => b.updatedAt.localeCompare(a.updatedAt) || byTitle(a, b),
  },
  created: {
    label: "Recently added",
    compare: (a, b) => b.createdAt.localeCompare(a.createdAt) || byTitle(a, b),
  },
};

export const DEFAULT_SORT: SortKey = "title";

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === "string" && value in SORTS;
}
