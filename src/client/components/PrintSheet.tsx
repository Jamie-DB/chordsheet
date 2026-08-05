import { buildChordRow, displayChord } from "../../engine";
import type { Song } from "../../shared/types";

interface Props {
  song: Song;
  soundingKey: string | null;
  shapedKeyName: string;
}

/**
 * The printable sheet: literal text rows only, never positioned elements,
 * so print alignment is exact by construction. Hidden on screen; print CSS
 * hides the app and shows this.
 */
export function PrintSheet({ song, soundingKey, shapedKeyName }: Props) {
  return (
    <div className="print-sheet">
      <div className="print-header">
        <h1>{song.title}</h1>
        {song.artist && <div className="print-artist">{song.artist}</div>}
        <div className="print-key">
          {soundingKey ? `Key: ${soundingKey}` : ""}
          {soundingKey && song.capo > 0 ? `, Capo ${song.capo}` : song.capo > 0 ? `Capo ${song.capo}` : ""}
        </div>
      </div>
      {song.lyrics.map((line, i) => {
        const row = buildChordRow(
          song.placements.filter((p) => p.line === i),
          (chord) => displayChord(chord, song.capo, shapedKeyName),
        );
        if (line.length === 0 && row.length === 0) {
          return <div className="print-gap" key={i} />;
        }
        return (
          <div className="print-pair" key={i}>
            {row.length > 0 && <pre className="print-chords">{row}</pre>}
            <pre className="print-lyric">{line || " "}</pre>
          </div>
        );
      })}
    </div>
  );
}
