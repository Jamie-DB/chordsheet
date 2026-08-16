import type { ReactNode } from "react";
import { buildChordRowSegments, displayChord } from "../../engine";
import type { Song } from "../../shared/types";
import { markColor, markFor, markName, sectionRanges } from "../lib/sectionMarks";
import { ChordChartRow } from "./ChordChartRow";
import { DiamondOutline } from "./DiamondOutline";

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

  const marks = song.sectionMarks ?? [];
  const ranges = sectionRanges(song.lyrics);
  const rangeByStart = new Map(ranges.map((r) => [r.start, r]));
  const sectionClassByLine = new Map<number, string>();
  const tacetLines = new Set<number>();
  for (const r of ranges) {
    const mark = markFor(marks, r.label, r.occurrence);
    if (!mark) continue;
    for (let i = r.start; i <= r.end; i++) {
      sectionClassByLine.set(i, ` sec-${markColor(mark)}`);
      if (mark.kind === "tacet") tacetLines.add(i);
    }
  }
  const stripBrackets = (label: string) => label.trim().replace(/^\[|\]$/g, "");

  return (
    <div className={`print-sheet${twoCol ? "" : " with-sidebar"}`}>
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
        {(() => {
          const body: ReactNode[] = [];
          let pendingSidebar: { title: string; mark: ReturnType<typeof markFor> } | null = null;

          const compactLabel = (key: React.Key, title: string, mark: ReturnType<typeof markFor>) => (
            <div className={`print-pair print-label-compact`} key={key}>
              <pre className="print-lyric">
                {title}
                {mark && (
                  <span className={`print-mark-name name-${markColor(mark)}`}>
                    {"  " + markName(mark).toUpperCase()}
                  </span>
                )}
              </pre>
            </div>
          );

          song.lyrics.forEach((line, i) => {
            const range = rangeByStart.get(i);
            if (range) {
              const mark = markFor(marks, range.label, range.occurrence);
              if (pendingSidebar) {
                // Empty section before this one: fall back to a compact row.
                body.push(compactLabel(`orphan-${i}`, pendingSidebar.title, pendingSidebar.mark));
                pendingSidebar = null;
              }
              if (twoCol) {
                body.push(compactLabel(i, stripBrackets(range.label), mark));
              } else {
                // The title leaves the flow and rides the next content pair.
                pendingSidebar = { title: stripBrackets(range.label), mark };
              }
              return;
            }
            const row = rows[i];
            if (line.length === 0 && row.length === 0) {
              body.push(<div className="print-gap" key={i} />);
              return;
            }
            const sidebar = pendingSidebar;
            pendingSidebar = null;
            body.push(
              <div
                className={`print-pair${sectionClassByLine.get(i) ?? ""}${tacetLines.has(i) ? " tacet-small" : ""}`}
                key={i}
              >
                {sidebar && (
                  <span className="print-side-label">
                    {sidebar.title}
                    {sidebar.mark && (
                      <span className={`print-mark-name name-${markColor(sidebar.mark)}`}>
                        {markName(sidebar.mark).toUpperCase()}
                      </span>
                    )}
                  </span>
                )}
                {row.length > 0 && (
                  <pre className="print-chords">
                    {row.map((s, j) =>
                      s.hold ? (
                        <span key={j} className="hold-diamond">
                          {s.text}
                          <DiamondOutline />
                        </span>
                      ) : (
                        s.text
                      ),
                    )}
                  </pre>
                )}
                <pre className="print-lyric">{line || " "}</pre>
              </div>,
            );
          });
          // TS cannot see the callback writes; re-widen before the last check.
          const leftover = pendingSidebar as { title: string; mark: ReturnType<typeof markFor> } | null;
          if (leftover) {
            body.push(compactLabel("orphan-end", leftover.title, leftover.mark));
          }
          return body;
        })()}
      </div>
    </div>
  );
}
