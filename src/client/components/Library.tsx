import { useRef, useState } from "react";
import type { Song } from "../../shared/types";
import {
  diskSyncSupported,
  ensurePermission,
  loadSavedDir,
  pickDir,
  syncSongs,
  type DirHandleLike,
} from "../lib/diskSync";
import { downloadSong, parseImport } from "../lib/exchange";

interface Props {
  songs: Song[];
  onCreate(title: string, artist: string, lyricsText: string, writtenForCapo: number): void;
  onOpen(id: string): void;
  onRename(id: string, title: string): void;
  onDelete(id: string): void;
  onImport(song: Song, open: boolean): void;
}

export function Library({ songs, onCreate, onOpen, onRename, onDelete, onImport }: Props) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [lyricsText, setLyricsText] = useState("");
  const [writtenCapo, setWrittenCapo] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveAll(forcePick: boolean) {
    try {
      let dir: DirHandleLike | null = forcePick ? null : await loadSavedDir();
      if (dir && !(await ensurePermission(dir))) dir = null;
      if (!dir) dir = await pickDir();
      if (!dir) return;
      const result = await syncSongs(songs, dir);
      const skipNote = result.skipped > 0 ? `, ${result.skipped} already up to date` : "";
      setSyncMsg(`Saved ${result.written} song file(s) to "${dir.name}"${skipNote}.`);
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      setSyncMsg("Could not save to the folder. Try choosing it again.");
    }
  }

  const sorted = [...songs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  function handleCreate() {
    if (!title.trim() && !lyricsText.trim()) {
      setStatus("Give the song a title, some lyrics, or both.");
      return;
    }
    onCreate(title, artist, lyricsText, writtenCapo);
    setTitle("");
    setArtist("");
    setLyricsText("");
    setWrittenCapo(0);
    setStatus(null);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const text = await file.text();
      let probableId: string | null = null;
      try {
        probableId = (JSON.parse(text) as { id?: string }).id ?? null;
      } catch {
        // parseImport reports the JSON error below.
      }
      const existing = songs.find((s) => s.id === probableId);
      const result = parseImport(text, existing);
      if (!result.ok) {
        setStatus(`${file.name}: ${result.error}`);
        return;
      }
      if (existing && !window.confirm(`Replace placements of "${existing.title}" with ${file.name}?`)) {
        continue;
      }
      onImport(result.song, files.length === 1);
      const notes: string[] = [];
      if (result.unresolved.length > 0) {
        notes.push(`${result.unresolved.length} placement(s) could not be resolved: ${result.unresolved.map((u) => `${u.chord} (${u.reason})`).join("; ")}`);
      }
      if (result.lyricsRejected) {
        notes.push("the file tried to change lyrics; kept the library's lyrics");
      }
      setStatus(notes.length > 0 ? `Imported ${file.name}, but ${notes.join("; ")}.` : `Imported ${file.name}.`);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="library">
      <header className="library-header">
        <h1>chordsheet</h1>
        <p className="tagline">Paste lyrics, place chords, print a clean sheet.</p>
      </header>

      <section className="new-song">
        <h2>New song</h2>
        <div className="new-song-fields">
          <input
            value={title}
            placeholder="Title"
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Title"
          />
          <input
            value={artist}
            placeholder="Artist (optional)"
            onChange={(e) => setArtist(e.target.value)}
            aria-label="Artist"
          />
        </div>
        <textarea
          value={lyricsText}
          placeholder="Paste lyrics, or a whole tab with chord lines above the words. Chord lines are detected and become placements."
          rows={8}
          onChange={(e) => setLyricsText(e.target.value)}
          aria-label="Lyrics or tab"
        />
        <div className="new-song-actions">
          <button className="primary" onClick={handleCreate}>Create</button>
          <label className="written-capo" title="If the pasted tab says 'Capo N', its chords are shapes at that fret. The song starts there and keeps its true key.">
            Written for capo{" "}
            <select value={writtenCapo} onChange={(e) => setWrittenCapo(Number(e.target.value))}>
              {Array.from({ length: 10 }, (_, fret) => (
                <option key={fret} value={fret}>
                  {fret === 0 ? "None" : `Fret ${fret}`}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => fileRef.current?.click()}>Import JSON</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            multiple
            hidden
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>
        {status && <p className="status">{status}</p>}
      </section>

      <section className="song-list">
        <div className="song-list-head">
          <h2>Library</h2>
          {sorted.length > 0 && (
            <span className="song-list-tools">
              <button
                onClick={() =>
                  diskSyncSupported()
                    ? void saveAll(false)
                    : setSyncMsg(
                        "Folder saving needs a Chromium browser (Chrome, Edge, Arc, Brave). In this browser, use per-song Export instead.",
                      )
                }
                title="Write every song as JSON into a folder you choose (checks disk first, skips unchanged files)"
              >
                Save all to folder
              </button>
              {diskSyncSupported() && (
                <button className="mini" onClick={() => void saveAll(true)} title="Pick a different folder">
                  change folder
                </button>
              )}
            </span>
          )}
        </div>
        {syncMsg && <p className="muted">{syncMsg}</p>}
        {sorted.length === 0 && <p className="muted">No songs yet.</p>}
        <ul>
          {sorted.map((song) => (
            <li key={song.id} className="song-row">
              <button className="song-open" onClick={() => onOpen(song.id)}>
                <span className="song-title">{song.title}</span>
                {song.artist && <span className="song-artist">{song.artist}</span>}
                {song.capo > 0 && <span className="badge">Capo {song.capo}</span>}
              </button>
              <span className="song-tools">
                <button
                  onClick={() => {
                    const next = window.prompt("Rename song", song.title);
                    if (next && next.trim()) onRename(song.id, next.trim());
                  }}
                >
                  Rename
                </button>
                <button onClick={() => downloadSong(song)}>Export</button>
                <button
                  className="danger"
                  onClick={() => {
                    if (window.confirm(`Delete "${song.title}"? This cannot be undone.`)) onDelete(song.id);
                  }}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
