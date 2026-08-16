import { buildChordRowSegments, displayChord } from "../../engine";
import type { Song } from "../../shared/types";
import { isSectionLabel } from "../lib/lineOps";
import { ChordChartRow } from "./ChordChartRow";

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
/** Widest row (chords or lyric) that still fits a two-column layout. */
const TWO_COLUMN_MAX_CHARS = 38;

export function PrintSheet({ song, soundingKey, shapedKeyName }: Props) {
  const rows = song.lyrics.map((_, i) =>
    buildChordRowSegments(
      song.placements.filter((p) => p.line === i),
      (chord) => displayChord(chord, song.capo, shapedKeyName),
    ),
  );
  const rowLength = (segments: (typeof rows)[number]) =>
    segments.reduce((n, s) => n + s.text.length, 0);
  const widest = Math.max(
    0,
    ...song.lyrics.map((l) => l.length),
    ...rows.map(rowLength),
  );
  const twoCol = widest > 0 && widest <= TWO_COLUMN_MAX_CHARS;

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
      {song.notes?.trim() && <pre className="print-notes">{song.notes.trim()}</pre>}
      <div className="print-diagrams">
        <ChordChartRow song={song} shapedKeyName={shapedKeyName} />
      </div>
      <div className={twoCol ? "print-body two-col" : "print-body"}>
        {song.lyrics.map((line, i) => {
          const row = rows[i];
          if (line.length === 0 && row.length === 0) {
            return <div className="print-gap" key={i} />;
          }
          return (
            <div className="print-pair" key={i}>
              {row.length > 0 && (
                <pre className="print-chords">
                  {row.map((s, j) =>
                    s.hold ? (
                      <span key={j} className="hold-diamond">
                        {s.text}
                      </span>
                    ) : (
                      s.text
                    ),
                  )}
                </pre>
              )}
              <pre className={`print-lyric${isSectionLabel(line) ? " section-label" : ""}`}>
                {line || " "}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
