import { useState } from "react";
import type { Setlist, Song } from "../../shared/types";
import { findArrangement } from "../lib/versions";

interface Props {
  set: Setlist;
  songs: Song[];
  onBack(): void;
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
  onAdd(setId: string, songId: string): void;
  onRemoveAt(setId: string, index: number): void;
  onMove(setId: string, index: number, delta: number): void;
  onOpenAt(setId: string, index: number): void;
  /** undefined plays the song as written. */
  onSetVersion(setId: string, index: number, arrangementId?: string): void;
}

export function SetView({ set, songs, ...props }: Props) {
  const [adding, setAdding] = useState("");
  const byId = new Map(songs.map((s) => [s.id, s]));
  const inSet = new Set(set.entries.map((e) => e.songId));
  const addable = [...songs].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

  return (
    <div className="library set-view">
      <div className="editor-bar">
        <button onClick={props.onBack}>Back to library</button>
        <div className="editor-heading">
          <strong>{set.name}</strong>
          <span className="muted"> {set.entries.length} song{set.entries.length === 1 ? "" : "s"}</span>
        </div>
        <button
          onClick={() => {
            const next = window.prompt("Rename set", set.name);
            if (next && next.trim()) props.onRename(set.id, next.trim());
          }}
        >
          Rename
        </button>
        <button
          className="danger"
          onClick={() => {
            if (window.confirm(`Delete the set "${set.name}"? Songs themselves are untouched.`)) {
              props.onDelete(set.id);
            }
          }}
        >
          Delete set
        </button>
      </div>

      <section className="song-list">
        {set.entries.length === 0 && <p className="muted">Empty set. Add songs below.</p>}
        <ul>
          {set.entries.map((entry, index) => {
            const song = byId.get(entry.songId);
            if (!song) return null;
            const version = findArrangement(song, entry.arrangementId);
            const versions = song.arrangements ?? [];
            return (
              <li key={`${entry.songId}-${index}`} className="song-row">
                <span className="set-order muted">{index + 1}.</span>
                <button className="song-open" onClick={() => props.onOpenAt(set.id, index)}>
                  <span className="song-title">{song.title}</span>
                  {song.artist && <span className="song-artist">{song.artist}</span>}
                  {version && <span className="badge">{version.name}</span>}
                  {song.capo > 0 && <span className="badge">Capo {song.capo}</span>}
                </button>
                <span className="song-tools">
                  {versions.length > 0 && (
                    <select
                      className="set-version"
                      value={version?.id ?? ""}
                      onChange={(e) => props.onSetVersion(set.id, index, e.target.value || undefined)}
                      aria-label={`Version of ${song.title} to play`}
                    >
                      <option value="">As written</option>
                      {versions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button className="mini" disabled={index === 0} onClick={() => props.onMove(set.id, index, -1)} title="Move up">
                    &#8593;
                  </button>
                  <button
                    className="mini"
                    disabled={index === set.entries.length - 1}
                    onClick={() => props.onMove(set.id, index, 1)}
                    title="Move down"
                  >
                    &#8595;
                  </button>
                  <button className="mini danger" onClick={() => props.onRemoveAt(set.id, index)} title="Remove from set">
                    &#215;
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="set-add">
        <h2>Add songs</h2>
        <div className="set-add-row">
          <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Song to add">
            <option value="">Choose a song</option>
            {addable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {inSet.has(s.id) ? " (again)" : ""}
              </option>
            ))}
          </select>
          <button
            className="primary"
            disabled={adding === ""}
            onClick={() => {
              props.onAdd(set.id, adding);
              setAdding("");
            }}
          >
            Add
          </button>
        </div>
      </section>
    </div>
  );
}
