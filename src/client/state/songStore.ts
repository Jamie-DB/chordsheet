import { useEffect, useMemo, useReducer, useRef } from "react";
import type { Setlist, Song } from "../../shared/types";
import { cleanSong } from "../lib/cleanSong";
import {
  addSongToSet,
  createSetlist,
  moveInSet,
  pruneSetlists,
  removeAtFromSet,
  setEntryArrangement,
} from "../lib/setOps";
import {
  loadLibrary,
  loadSetlists,
  saveLibrary,
  saveSetlists,
  slugify,
} from "../lib/storage";
import { parsePastedTab } from "../lib/tabPaste";

export type View =
  | { name: "library" }
  | { name: "editor"; id: string; setId?: string; setIndex?: number; arrangementId?: string }
  | { name: "set"; id: string };

export interface AppState {
  songs: Song[];
  setlists: Setlist[];
  view: View;
}

export type Action =
  | { type: "addSong"; song: Song; open: boolean }
  | { type: "open"; id: string }
  | { type: "openInSet"; setId: string; setIndex: number }
  | { type: "openSet"; id: string }
  | { type: "close" }
  | { type: "rename"; id: string; title: string }
  | { type: "delete"; id: string }
  | { type: "replaceSong"; song: Song }
  | { type: "createSet"; name: string }
  | { type: "renameSet"; id: string; name: string }
  | { type: "deleteSet"; id: string }
  | { type: "addToSet"; setId: string; songId: string }
  | { type: "removeFromSet"; setId: string; index: number }
  | { type: "moveInSet"; setId: string; index: number; delta: number }
  | { type: "setEntryArrangement"; setId: string; index: number; arrangementId?: string }
  | { type: "importSetlists"; sets: Setlist[] };

function stamp(song: Song): Song {
  return { ...song, updatedAt: new Date().toISOString() };
}

/**
 * One-time fix-up of stored songs on load (see cleanSong). updatedAt is
 * deliberately untouched so cleaned browser and disk copies stay identical
 * and folder sync keeps skipping them.
 */
function migrate(songs: Song[]): Song[] {
  let anyChanged = false;
  const migrated = songs.map((song) => {
    const result = cleanSong(song);
    if (result.changed) anyChanged = true;
    return result.song;
  });
  if (anyChanged) saveLibrary(migrated);
  return migrated;
}

function updateSet(state: AppState, id: string, fn: (set: Setlist) => Setlist): AppState {
  return { ...state, setlists: state.setlists.map((s) => (s.id === id ? fn(s) : s)) };
}

/** Pure; exported for tests. */
export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "addSong": {
      const others = state.songs.filter((s) => s.id !== action.song.id);
      return {
        ...state,
        songs: [...others, action.song],
        view: action.open ? { name: "editor", id: action.song.id } : state.view,
      };
    }
    case "open":
      return { ...state, view: { name: "editor", id: action.id } };
    case "openInSet": {
      const set = state.setlists.find((s) => s.id === action.setId);
      const entry = set?.entries[action.setIndex];
      if (!set || entry === undefined) return state;
      return {
        ...state,
        view: {
          name: "editor",
          id: entry.songId,
          setId: action.setId,
          setIndex: action.setIndex,
          ...(entry.arrangementId ? { arrangementId: entry.arrangementId } : {}),
        },
      };
    }
    case "openSet":
      return { ...state, view: { name: "set", id: action.id } };
    case "close":
      return { ...state, view: { name: "library" } };
    case "rename":
      return {
        ...state,
        songs: state.songs.map((s) => (s.id === action.id ? stamp({ ...s, title: action.title }) : s)),
      };
    case "delete": {
      const songs = state.songs.filter((s) => s.id !== action.id);
      return {
        ...state,
        songs,
        setlists: pruneSetlists(state.setlists, songs).sets,
        view:
          state.view.name === "editor" && state.view.id === action.id
            ? { name: "library" }
            : state.view,
      };
    }
    case "replaceSong": {
      const songs = state.songs.map((s) => (s.id === action.song.id ? stamp(action.song) : s));
      // A deleted version falls back to the song as written in every set.
      const pruned = pruneSetlists(state.setlists, songs);
      return { ...state, songs, setlists: pruned.changed ? pruned.sets : state.setlists };
    }
    case "createSet": {
      const set = createSetlist(action.name, new Set(state.setlists.map((s) => s.id)));
      return { ...state, setlists: [...state.setlists, set], view: { name: "set", id: set.id } };
    }
    case "renameSet":
      return updateSet(state, action.id, (s) => ({
        ...s,
        name: action.name,
        updatedAt: new Date().toISOString(),
      }));
    case "deleteSet":
      return {
        ...state,
        setlists: state.setlists.filter((s) => s.id !== action.id),
        view: state.view.name === "set" && state.view.id === action.id ? { name: "library" } : state.view,
      };
    case "addToSet":
      return updateSet(state, action.setId, (s) => addSongToSet(s, action.songId));
    case "removeFromSet":
      return updateSet(state, action.setId, (s) => removeAtFromSet(s, action.index));
    case "moveInSet":
      return updateSet(state, action.setId, (s) => moveInSet(s, action.index, action.delta));
    case "setEntryArrangement":
      return updateSet(state, action.setId, (s) =>
        setEntryArrangement(s, action.index, action.arrangementId),
      );
    case "importSetlists": {
      const byId = new Map(state.setlists.map((s) => [s.id, s]));
      for (const set of action.sets) byId.set(set.id, set);
      return {
        ...state,
        setlists: pruneSetlists([...byId.values()], state.songs).sets,
      };
    }
  }
}

export interface SongActions {
  /** writtenForCapo: the pasted tab's capo; symbols are read as shapes at that fret. */
  createSong(title: string, artist: string, lyricsText: string, writtenForCapo: number): void;
  /** keepUpdatedAt: a backup restore keeps the file's timestamp; any other import stamps now. */
  importSong(song: Song, open: boolean, keepUpdatedAt?: boolean): void;
  open(id: string): void;
  openInSet(setId: string, setIndex: number): void;
  openSet(id: string): void;
  close(): void;
  rename(id: string, title: string): void;
  remove(id: string): void;
  replaceSong(song: Song): void;
  createSet(name: string): void;
  renameSet(id: string, name: string): void;
  deleteSet(id: string): void;
  addToSet(setId: string, songId: string): void;
  removeFromSet(setId: string, index: number): void;
  moveInSet(setId: string, index: number, delta: number): void;
  /** Choose the version a set entry plays; undefined means as written. */
  setEntryArrangement(setId: string, index: number, arrangementId?: string): void;
  importSetlists(sets: Setlist[]): void;
}

export function useSongStore(): [AppState, SongActions] {
  const [state, dispatch] = useReducer(reducer, undefined, (): AppState => {
    const songs = migrate(loadLibrary());
    return {
      songs,
      setlists: pruneSetlists(loadSetlists(), songs).sets,
      view: { name: "library" },
    };
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Autosave library and setlists, debounced. pending marks a change the
  // timer has not written yet.
  const first = useRef(true);
  const pending = useRef(false);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pending.current = true;
    const t = setTimeout(() => {
      saveLibrary(state.songs);
      saveSetlists(state.setlists);
      pending.current = false;
    }, 800);
    return () => clearTimeout(t);
  }, [state.songs, state.setlists]);

  // Closing the tab inside the debounce window would lose the last edit, so
  // write it on the way out. Only a pending edit is written: a tab with
  // nothing unsaved must not overwrite what another tab saved since.
  useEffect(() => {
    const flush = () => {
      if (!pending.current) return;
      saveLibrary(stateRef.current.songs);
      saveSetlists(stateRef.current.setlists);
      pending.current = false;
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const actions = useMemo<SongActions>(
    () => ({
      createSong(title, artist, lyricsText, writtenForCapo) {
        const taken = new Set(stateRef.current.songs.map((s) => s.id));
        const now = new Date().toISOString();
        const parsed = parsePastedTab(lyricsText, writtenForCapo);
        const song: Song = {
          version: 1,
          id: slugify(title, taken),
          title: title.trim() || "Untitled",
          artist: artist.trim() || undefined,
          lyrics: parsed.lyrics,
          placements: parsed.placements,
          sectionMarks: parsed.sectionMarks.length > 0 ? parsed.sectionMarks : undefined,
          keyOverride: null,
          capo: writtenForCapo,
          bpm: parsed.bpm ?? undefined,
          createdAt: now,
          updatedAt: now,
        };
        dispatch({ type: "addSong", song, open: true });
      },
      importSong(song, open, keepUpdatedAt = false) {
        dispatch({ type: "addSong", song: keepUpdatedAt ? song : stamp(song), open });
      },
      open(id) {
        dispatch({ type: "open", id });
      },
      openInSet(setId, setIndex) {
        dispatch({ type: "openInSet", setId, setIndex });
      },
      openSet(id) {
        dispatch({ type: "openSet", id });
      },
      close() {
        dispatch({ type: "close" });
      },
      rename(id, title) {
        dispatch({ type: "rename", id, title });
      },
      remove(id) {
        dispatch({ type: "delete", id });
      },
      replaceSong(song) {
        dispatch({ type: "replaceSong", song });
      },
      createSet(name) {
        dispatch({ type: "createSet", name });
      },
      renameSet(id, name) {
        dispatch({ type: "renameSet", id, name });
      },
      deleteSet(id) {
        dispatch({ type: "deleteSet", id });
      },
      addToSet(setId, songId) {
        dispatch({ type: "addToSet", setId, songId });
      },
      removeFromSet(setId, index) {
        dispatch({ type: "removeFromSet", setId, index });
      },
      moveInSet(setId, index, delta) {
        dispatch({ type: "moveInSet", setId, index, delta });
      },
      setEntryArrangement(setId, index, arrangementId) {
        dispatch({ type: "setEntryArrangement", setId, index, arrangementId });
      },
      importSetlists(sets) {
        dispatch({ type: "importSetlists", sets });
      },
    }),
    [],
  );

  return [state, actions];
}
