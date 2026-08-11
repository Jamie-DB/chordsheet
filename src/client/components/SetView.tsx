import { useState } from "react";
import type { Setlist, Song } from "../../shared/types";

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
}

export function SetView({ set, songs, ...props }: Props) {
  const [adding, setAdding] = useState("");
  const byId = new Map(songs.map((s) => [s.id, s]));
  const inSet = new Set(set.songIds);
  const addable = [...songs].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

  return (
    <div className="library set-view">
      <div className="editor-bar">
        <button onClick={props.onBack}>Back to library</button>
        <div className="editor-heading">
          <strong>{set.name}</strong>
          <span className="muted"> {set.songIds.length} song{set.songIds.length === 1 ? "" : "s"}</span>
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
        {set.songIds.length === 0 && <p className="muted">Empty set. Add songs below.</p>}
        <ul>
          {set.songIds.map((songId, index) => {
            const song = byId.get(songId);
            if (!song) return null;
            return (
              <li key={`${songId}-${index}`} className="song-row">
                <span className="set-order muted">{index + 1}.</span>
                <button className="song-open" onClick={() => props.onOpenAt(set.id, index)}>
                  <span className="song-title">{song.title}</span>
                  {song.artist && <span className="song-artist">{song.artist}</span>}
                  {song.capo > 0 && <span className="badge">Capo {song.capo}</span>}
                </button>
                <span className="song-tools">
                  <button className="mini" disabled={index === 0} onClick={() => props.onMove(set.id, index, -1)} title="Move up">
                    &#8593;
                  </button>
                  <button
                    className="mini"
                    disabled={index === set.songIds.length - 1}
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
