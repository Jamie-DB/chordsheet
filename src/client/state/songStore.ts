import { useEffect, useMemo, useReducer, useRef } from "react";
import type { Song } from "../../shared/types";
import { normalizeSections, stripPageLines } from "../lib/normalize";
import { loadLibrary, saveLibrary, slugify } from "../lib/storage";
import { parsePastedTab } from "../lib/tabPaste";

/**
 * One-time fix-up of stored songs on load: page artifacts stripped, section
 * spacing normalized. updatedAt is deliberately untouched so cleaned browser
 * and disk copies stay identical and folder sync keeps skipping them.
 */
function migrate(songs: Song[]): Song[] {
  let anyChanged = false;
  const migrated = songs.map((song) => {
    const stripped = stripPageLines(song.lyrics, song.placements);
    const n = normalizeSections(stripped.lyrics, stripped.placements);
    if (!stripped.changed && !n.changed) return song;
    anyChanged = true;
    return { ...song, lyrics: n.lyrics, placements: n.placements };
  });
  if (anyChanged) saveLibrary(migrated);
  return migrated;
}

export type View = { name: "library" } | { name: "editor"; id: string };

export interface AppState {
  songs: Song[];
  view: View;
}

type Action =
  | { type: "addSong"; song: Song; open: boolean }
  | { type: "open"; id: string }
  | { type: "close" }
  | { type: "rename"; id: string; title: string }
  | { type: "delete"; id: string }
  | { type: "replaceSong"; song: Song };

function stamp(song: Song): Song {
  return { ...song, updatedAt: new Date().toISOString() };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "addSong": {
      const others = state.songs.filter((s) => s.id !== action.song.id);
      return {
        songs: [...others, action.song],
        view: action.open ? { name: "editor", id: action.song.id } : state.view,
      };
    }
    case "open":
      return { ...state, view: { name: "editor", id: action.id } };
    case "close":
      return { ...state, view: { name: "library" } };
    case "rename":
      return {
        ...state,
        songs: state.songs.map((s) => (s.id === action.id ? stamp({ ...s, title: action.title }) : s)),
      };
    case "delete":
      return {
        songs: state.songs.filter((s) => s.id !== action.id),
        view: state.view.name === "editor" && state.view.id === action.id ? { name: "library" } : state.view,
      };
    case "replaceSong":
      return {
        ...state,
        songs: state.songs.map((s) => (s.id === action.song.id ? stamp(action.song) : s)),
      };
  }
}

export interface SongActions {
  /** writtenForCapo: the pasted tab's capo; symbols are read as shapes at that fret. */
  createSong(title: string, artist: string, lyricsText: string, writtenForCapo: number): void;
  importSong(song: Song, open: boolean): void;
  open(id: string): void;
  close(): void;
  rename(id: string, title: string): void;
  remove(id: string): void;
  replaceSong(song: Song): void;
}

export function useSongStore(): [AppState, SongActions] {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    (): AppState => ({ songs: migrate(loadLibrary()), view: { name: "library" } }),
  );

  // Autosave the whole library, debounced.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => saveLibrary(state.songs), 800);
    return () => clearTimeout(t);
  }, [state.songs]);

  const stateRef = useRef(state);
  stateRef.current = state;

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
          keyOverride: null,
          capo: writtenForCapo,
          bpm: parsed.bpm ?? undefined,
          createdAt: now,
          updatedAt: now,
        };
        dispatch({ type: "addSong", song, open: true });
      },
      importSong(song, open) {
        dispatch({ type: "addSong", song: stamp(song), open });
      },
      open(id) {
        dispatch({ type: "open", id });
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
    }),
    [],
  );

  return [state, actions];
}
