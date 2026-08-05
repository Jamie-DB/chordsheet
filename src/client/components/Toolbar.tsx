import { keyName, shapedKey } from "../../engine";
import type { Song } from "../../shared/types";
import { transposeSong } from "../lib/songOps";

interface Props {
  song: Song;
  /** Effective sounding key: override, or detected, or null. */
  soundingKey: string | null;
  detectedKey: string | null;
  onChange(song: Song): void;
  onToggleSuggestions(): void;
  showingSuggestions: boolean;
  onPrint?(): void;
  onCopyText?(): void;
  copiedText?: boolean;
}

const ALL_KEYS: string[] = [
  ...Array.from({ length: 12 }, (_, pc) => keyName(pc, "major")),
  ...Array.from({ length: 12 }, (_, pc) => keyName(pc, "minor")),
];

export function Toolbar(props: Props) {
  const { song, soundingKey, detectedKey, onChange } = props;

  function transpose(semitones: number) {
    onChange(transposeSong(song, soundingKey, semitones));
  }

  const shaped = soundingKey ? shapedKey(soundingKey, song.capo) : null;

  return (
    <div className="toolbar">
      <span className="toolbar-group" title="Change the actual key of the song">
        <span className="toolbar-label">Transpose</span>
        <button onClick={() => transpose(-1)} disabled={song.placements.length === 0}>-1</button>
        <button onClick={() => transpose(1)} disabled={song.placements.length === 0}>+1</button>
      </span>

      <span className="toolbar-group" title="Sounding key; auto-detected from the chords unless overridden">
        <span className="toolbar-label">Key</span>
        <select
          value={song.keyOverride ?? "auto"}
          onChange={(e) =>
            onChange({ ...song, keyOverride: e.target.value === "auto" ? null : e.target.value })
          }
        >
          <option value="auto">{detectedKey ? `Auto (${detectedKey})` : "Auto"}</option>
          {ALL_KEYS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </span>

      <span className="toolbar-group" title="Capo keeps the key; it changes which shapes you play">
        <span className="toolbar-label">Capo</span>
        <select
          value={song.capo}
          onChange={(e) => onChange({ ...song, capo: Number(e.target.value) })}
        >
          {Array.from({ length: 10 }, (_, fret) => (
            <option key={fret} value={fret}>
              {fret === 0 ? "None" : `Fret ${fret}`}
            </option>
          ))}
        </select>
        <button onClick={props.onToggleSuggestions} disabled={song.placements.length === 0}>
          {props.showingSuggestions ? "Hide suggestions" : "Suggest capo"}
        </button>
      </span>

      <span className="toolbar-header-preview">
        {soundingKey ? `Key: ${soundingKey}` : "Key: unknown"}
        {song.capo > 0 && `, Capo ${song.capo}`}
        {song.capo > 0 && shaped && ` (play ${shaped} shapes)`}
      </span>

      {props.onCopyText && (
        <button onClick={props.onCopyText}>{props.copiedText ? "Copied" : "Copy text"}</button>
      )}
      {props.onPrint && (
        <button className="primary" onClick={props.onPrint}>
          Print
        </button>
      )}
    </div>
  );
}
