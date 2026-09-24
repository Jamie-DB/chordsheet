import type { Song } from "../../shared/types";
import { createArrangement, withArrangement, withoutArrangement } from "../lib/arrangement";
import { defaultVersionName, findArrangement } from "../lib/versions";

interface Props {
  song: Song;
  /** null plays the song as written. */
  activeId: string | null;
  /** Locked while the lyrics are open for editing. */
  disabled: boolean;
  onSelect(id: string | null): void;
  onChange(song: Song): void;
}

/** Pick, create, rename, duplicate, and delete the song's named versions. */
export function VersionBar({ song, activeId, disabled, onSelect, onChange }: Props) {
  const versions = song.arrangements ?? [];
  const active = findArrangement(song, activeId);

  function create() {
    const suggested = defaultVersionName(new Date());
    const name = window.prompt("Name the new version", suggested);
    if (name === null) return;
    const version = createArrangement(song, name.trim() || suggested);
    onChange(withArrangement(song, version));
    onSelect(version.id);
  }

  function rename() {
    if (!active) return;
    const name = window.prompt("Rename version", active.name);
    if (!name?.trim() || name.trim() === active.name) return;
    onChange(withArrangement(song, { ...active, name: name.trim() }));
  }

  function duplicate() {
    if (!active) return;
    const copy = createArrangement(song, `${active.name} copy`, active.steps.map((s) => ({ ...s })));
    onChange(withArrangement(song, copy));
    onSelect(copy.id);
  }

  function remove() {
    if (!active) return;
    if (!window.confirm(`Delete the version "${active.name}"? The song as written stays as it is.`)) return;
    onChange(withoutArrangement(song, active.id));
    onSelect(null);
  }

  return (
    <div className="version-bar">
      <label className="version-pick">
        <span className="toolbar-label">Version</span>
        <select
          value={active?.id ?? ""}
          disabled={disabled}
          onChange={(e) => onSelect(e.target.value || null)}
          aria-label="Version"
        >
          <option value="">As written</option>
          {versions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <button className="mini" disabled={disabled} onClick={create}>
        New version
      </button>
      {active && (
        <>
          <button className="mini" onClick={rename}>
            Rename
          </button>
          <button className="mini" onClick={duplicate}>
            Duplicate
          </button>
          <button className="mini danger" onClick={remove}>
            Delete
          </button>
        </>
      )}
    </div>
  );
}
