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
    entries: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function addSongToSet(set: Setlist, songId: string, arrangementId?: string): Setlist {
  return stamp({ ...set, entries: [...set.entries, { songId, ...(arrangementId ? { arrangementId } : {}) }] });
}

/** Choose which version an entry plays; undefined means the song as written. */
export function setEntryArrangement(set: Setlist, index: number, arrangementId?: string): Setlist {
  if (index < 0 || index >= set.entries.length) return set;
  return stamp({
    ...set,
    entries: set.entries.map((e, i) =>
      i === index ? { songId: e.songId, ...(arrangementId ? { arrangementId } : {}) } : e,
    ),
  });
}

export function removeAtFromSet(set: Setlist, index: number): Setlist {
  if (index < 0 || index >= set.entries.length) return set;
  return stamp({ ...set, entries: set.entries.filter((_, i) => i !== index) });
}

export function moveInSet(set: Setlist, index: number, delta: number): Setlist {
  const target = index + delta;
  if (index < 0 || index >= set.entries.length || target < 0 || target >= set.entries.length) {
    return set;
  }
  const entries = [...set.entries];
  const [moved] = entries.splice(index, 1);
  entries.splice(target, 0, moved);
  return stamp({ ...set, entries });
}

/**
 * Drop entries for songs no longer in the library, and fall back to the
 * song as written when an entry's arrangement was deleted.
 */
export function pruneSetlists(sets: Setlist[], songs: Song[]): { sets: Setlist[]; changed: boolean } {
  const arrangementsBySong = new Map(
    songs.map((s) => [s.id, new Set((s.arrangements ?? []).map((a) => a.id))]),
  );
  let changed = false;
  const pruned = sets.map((set) => {
    let setChanged = false;
    const entries = set.entries.flatMap((e) => {
      const known = arrangementsBySong.get(e.songId);
      if (!known) {
        setChanged = true;
        return [];
      }
      if (e.arrangementId !== undefined && !known.has(e.arrangementId)) {
        setChanged = true;
        return [{ songId: e.songId }];
      }
      return [e];
    });
    if (!setChanged) return set;
    changed = true;
    return { ...set, entries };
  });
  return { sets: pruned, changed };
}
