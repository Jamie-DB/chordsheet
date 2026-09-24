import { useMemo, useState } from "react";
import { keyName } from "../../engine/key";
import { ingestChart, type WordBox } from "../../ingest/chartPdf";
import { groupLog, previewLines } from "../../ingest/review";
import { songSchema } from "../../shared/schemas";
import type { Song } from "../../shared/types";

const KEYS = (["major", "minor"] as const).flatMap((mode) => Array.from({ length: 12 }, (_, pc) => keyName(pc, mode)));

interface Props {
  fileName: string;
  words: WordBox[];
  songs: Song[];
  onAdd(song: Song): void;
  onDiscard(): void;
}

/** The ingest review: what the chart became, and every correction to check against the PDF. */
export function PdfImportReview({ fileName, words, songs, onAdd, onDiscard }: Props) {
  const [key, setKey] = useState<string | undefined>(undefined);
  const takenIds = useMemo(() => new Set(songs.map((s) => s.id)), [songs]);
  const { song, log } = useMemo(() => ingestChart(words, { key, takenIds }), [words, key, takenIds]);
  const headerKey = useMemo(() => ingestChart(words).song.keyOverride, [words]);
  const keys = headerKey && !KEYS.includes(headerKey) ? [headerKey, ...KEYS] : KEYS;
  const readable = song.lyrics.some((line) => line.trim() !== "") && songSchema.safeParse(song).success;
  const clash = songs.find((s) => s.title.toLowerCase() === song.title.toLowerCase());
  const chords = [...new Set(song.placements.map((p) => p.chord))].sort();

  return (
    <section className="review-panel pdf-review">
      <div className="review-head">
        <strong>{readable ? song.title : fileName}</strong>
        {readable && song.artist && <span className="muted">{song.artist}</span>}
        {readable && (
          <span className="muted">
            {song.lyrics.length} lines, {song.placements.length} chords from {fileName}
          </span>
        )}
      </div>
      {!readable ? (
        <p className="status">
          No song was found in this PDF. The importer reads one chart layout, with section labels over chord and lyric rows.
          A different layout needs new constants in src/ingest/chartPdf.ts.
        </p>
      ) : (
        <>
          <div className="pdf-review-key">
            <label>
              Key{" "}
              <select value={song.keyOverride ?? ""} onChange={(e) => setKey(e.target.value || undefined)}>
                {!song.keyOverride && <option value="">Not found</option>}
                {keys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                    {k === headerKey ? " (chart header)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <span className="muted">
              The chart header loses its own sharp or flat, so a chart in Bb reads as B. Pick the real key and the chords are read again.
            </span>
          </div>
          <p className="muted">Chords: {chords.join(" ") || "none"}</p>
          {clash && (
            <p className="status">
              "{clash.title}" is already in the library. Adding this one makes a second copy.
            </p>
          )}
          <h3>Check these against the PDF</h3>
          <ul className="pdf-review-log">
            <li>Every sharp and flat. The chart's text drops them, and they are restored from spacing and the key signature.</li>
            {groupLog(log).map(({ entry, count }) => (
              <li key={entry}>
                {entry}
                {count > 1 ? ` (x${count})` : ""}
              </li>
            ))}
          </ul>
          <pre className="pdf-preview">{previewLines(song).join("\n")}</pre>
        </>
      )}
      <div className="review-head">
        <button className="primary" disabled={!readable} onClick={() => onAdd(song)}>
          Add to library
        </button>
        <button onClick={onDiscard}>Discard</button>
      </div>
    </section>
  );
}
