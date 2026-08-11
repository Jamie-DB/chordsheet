import type { Setlist, Song } from "../../shared/types";
import { slugify } from "./storage";

function stamp(set: Setlist): Setlist {
  return { ...set, updatedAt: new Date().toISOString() };
}

export function createSetlist(name: string, takenIds: Set<string>): Setlist {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: slugify(name, takenIds),
    name: name.trim() || "Untitled set",
    songIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function addSongToSet(set: Setlist, songId: string): Setlist {
  return stamp({ ...set, songIds: [...set.songIds, songId] });
}

export function removeAtFromSet(set: Setlist, index: number): Setlist {
  if (index < 0 || index >= set.songIds.length) return set;
  return stamp({ ...set, songIds: set.songIds.filter((_, i) => i !== index) });
}

export function moveInSet(set: Setlist, index: number, delta: number): Setlist {
  const target = index + delta;
  if (index < 0 || index >= set.songIds.length || target < 0 || target >= set.songIds.length) {
    return set;
  }
  const songIds = [...set.songIds];
  const [moved] = songIds.splice(index, 1);
  songIds.splice(target, 0, moved);
  return stamp({ ...set, songIds });
}

/** Drop song ids that no longer exist in the library. */
export function pruneSetlists(sets: Setlist[], songs: Song[]): { sets: Setlist[]; changed: boolean } {
  const known = new Set(songs.map((s) => s.id));
  let changed = false;
  const pruned = sets.map((set) => {
    const songIds = set.songIds.filter((id) => known.has(id));
    if (songIds.length === set.songIds.length) return set;
    changed = true;
    return { ...set, songIds };
  });
  return { sets: pruned, changed };
}
