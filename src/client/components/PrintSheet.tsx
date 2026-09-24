import type { ReactNode } from "react";
import { buildChordRowSegments, displayChord } from "../../engine";
import type { Song } from "../../shared/types";
import { markColor, markFor, markName, sectionRanges, sectionStyling, stripBrackets } from "../lib/sectionMarks";
import { headerKeyLine } from "../lib/sheetText";
import { ChordChartRow } from "./ChordChartRow";
import { DiamondOutline } from "./DiamondOutline";

interface Props {
  song: Song;
  soundingKey: string | null;
  shapedKeyName: string;
}

/** Widest row (chords or lyric) that still fits a two-column layout. */
const TWO_COLUMN_MAX_CHARS = 38;

/**
 * The printable sheet: literal text rows only, never positioned elements,
 * so print alignment is exact by construction. Hidden on screen; print CSS
 * hides the app and shows this.
 */
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
  const { colorByLine, tacetLines } = sectionStyling(song.lyrics, marks);
  const pairClass = (i: number): string => {
    const color = colorByLine.get(i);
    return `print-pair${color ? ` sec-${color}` : ""}${tacetLines.has(i) ? " tacet-small" : ""}`;
  };

  return (
    <div className={`print-sheet${twoCol ? "" : " with-sidebar"}`}>
      <div className="print-header">
        <h1>{song.title}</h1>
        {song.artist && <div className="print-artist">{song.artist}</div>}
        <div className="print-key">{headerKeyLine(soundingKey, song.capo)}</div>
      </div>
      {song.notes?.trim() && <pre className="print-notes">{song.notes.trim()}</pre>}
      <div className="print-diagrams">
        <ChordChartRow song={song} shapedKeyName={shapedKeyName} />
      </div>
      <div className={twoCol ? "print-body two-col" : "print-body"}>
        {(() => {
          type Sidebar = { title: string; mark: ReturnType<typeof markFor> };
          const body: ReactNode[] = [];
          let pendingSidebar: Sidebar | null = null;

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

          const pair = (key: React.Key, i: number, sidebar: Sidebar | null, lyric: string | null) => {
            const row = rows[i];
            return (
              <div className={pairClass(i)} key={key}>
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
                {lyric !== null && <pre className="print-lyric">{lyric || " "}</pre>}
              </div>
            );
          };

          song.lyrics.forEach((line, i) => {
            const row = rows[i];
            const range = rangeByStart.get(i);
            if (range) {
              const mark = markFor(marks, range.label, range.occurrence);
              if (pendingSidebar) {
                // Empty section before this one: fall back to a compact row.
                body.push(compactLabel(`orphan-${i}`, pendingSidebar.title, pendingSidebar.mark));
                pendingSidebar = null;
              }
              const title = stripBrackets(range.label);
              if (twoCol) {
                // Chords placed on the label line print above the label.
                if (row.length > 0) body.push(pair(`label-chords-${i}`, i, null, null));
                body.push(compactLabel(i, title, mark));
              } else if (row.length > 0) {
                // Chords on the label line get their own row, which carries the title.
                body.push(pair(i, i, { title, mark }, null));
              } else {
                // The title leaves the flow and rides the next content pair.
                pendingSidebar = { title, mark };
              }
              return;
            }
            if (line.length === 0 && row.length === 0) {
              body.push(<div className="print-gap" key={i} />);
              return;
            }
            const sidebar = pendingSidebar;
            pendingSidebar = null;
            body.push(pair(i, i, sidebar, line));
          });
          // TS cannot see the callback writes; re-widen before the last check.
          const leftover = pendingSidebar as Sidebar | null;
          if (leftover) {
            body.push(compactLabel("orphan-end", leftover.title, leftover.mark));
          }
          return body;
        })()}
      </div>
    </div>
  );
}
