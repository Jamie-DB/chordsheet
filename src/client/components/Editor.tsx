import { buildChordRow, detectKey, displayChord, shapedKey } from "../../engine";
import type { ChordPlacement, Song } from "../../shared/types";

interface Props {
  song: Song;
  onBack(): void;
  onChange(song: Song): void;
}

export function songKeyName(song: Song): string | null {
  if (song.keyOverride) return song.keyOverride;
  return detectKey(song.placements.map((p) => p.chord))?.name ?? null;
}

function chordRowText(placements: ChordPlacement[], capo: number, shapedKeyName: string): string {
  return buildChordRow(placements, (chord) => displayChord(chord, capo, shapedKeyName)) || " ";
}

export function Editor({ song, onBack }: Props) {
  const soundingKey = songKeyName(song);
  // With no detectable key yet, spell shapes sharp-side by default.
  const shaped = soundingKey ? shapedKey(soundingKey, song.capo) : "C";

  return (
    <div className="editor">
      <div className="editor-bar">
        <button onClick={onBack}>Back to library</button>
        <div className="editor-heading">
          <strong>{song.title}</strong>
          {song.artist && <span className="muted"> {song.artist}</span>}
        </div>
        <div className="editor-key">
          {soundingKey ? `Key: ${soundingKey}` : "Key: unknown"}
          {song.capo > 0 && `, Capo ${song.capo}`}
        </div>
      </div>

      <div className="sheet">
        {song.lyrics.map((line, i) => {
          const linePlacements = song.placements.filter((p) => p.line === i);
          return (
            <div className="line-pair" key={i}>
              <pre className="chord-row">{chordRowText(linePlacements, song.capo, shaped)}</pre>
              <pre className="lyric-row">{line || " "}</pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
