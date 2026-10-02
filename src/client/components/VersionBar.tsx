import type { Song } from "../../shared/types";
import { WRITTEN_NAME, createArrangement, withArrangement, withoutArrangement } from "../lib/charts";
import { defaultVersionName, findArrangement } from "../lib/versions";

interface Props {
  /** The stored song, with every version. */
  song: Song;
  /** null is the song as written. */
  activeId: string | null;
  /** Locked while the lyrics are open for editing. */
  disabled: boolean;
  onSelect(id: string | null): void;
  onChange(song: Song): void;
}

/** Pick, create, rename, and delete the song's versions. Each is its own chart. */
export function VersionBar({ song, activeId, disabled, onSelect, onChange }: Props) {
  const versions = song.arrangements ?? [];
  const active = findArrangement(song, activeId);

  function create() {
    const suggested = defaultVersionName(new Date());
    const name = window.prompt(`Name the new version (a copy of ${active?.name ?? WRITTEN_NAME})`, suggested);
    if (name === null) return;
    const version = createArrangement(song, name.trim() || suggested, active?.id ?? null);
    onChange(withArrangement(song, version));
    onSelect(version.id);
  }

  function rename() {
    if (!active) return;
    const name = window.prompt("Rename version", active.name);
    if (!name?.trim() || name.trim() === active.name) return;
    onChange(withArrangement(song, { ...active, name: name.trim() }));
  }

  function remove() {
    if (!active) return;
    if (!window.confirm(`Delete the version "${active.name}"? Every other version stays as it is.`)) return;
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
          <option value="">{WRITTEN_NAME}</option>
          {versions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="mini"
        disabled={disabled}
        title="Make a new version as a full copy of this one"
        onClick={create}
      >
        New version
      </button>
      {active && (
        <>
          <button className="mini" onClick={rename}>
            Rename
          </button>
          <button className="mini danger" onClick={remove}>
            Delete
          </button>
        </>
      )}
    </div>
  );
}
