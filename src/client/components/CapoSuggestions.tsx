import { suggestCapo } from "../../engine";
import type { Song } from "../../shared/types";

interface Props {
  song: Song;
  soundingKey: string;
  onApply(fret: number): void;
}

export function CapoSuggestions({ song, soundingKey, onApply }: Props) {
  const ranked = suggestCapo(
    song.placements.map((p) => p.chord),
    soundingKey,
  ).slice(0, 5);

  return (
    <div className="capo-suggestions">
      <strong>Capo suggestions</strong>
      <span className="muted"> Same key, different shapes under your hands. Ranked by open-chord friendliness.</span>
      <ul>
        {ranked.map((s) => (
          <li key={s.fret} className={s.fret === song.capo ? "current" : ""}>
            <span className="capo-fret">{s.fret === 0 ? "No capo" : `Capo ${s.fret}`}</span>
            <span className="capo-shapes">
              ({s.shapedKeyName} shapes): {s.shapes.join("  ")}
            </span>
            {s.fret === song.capo ? (
              <span className="badge">current</span>
            ) : (
              <button className="mini" onClick={() => onApply(s.fret)}>
                Apply
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
