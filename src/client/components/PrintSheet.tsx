import type { ReactNode } from "react";
import { buildChordRowSegments, displayChord } from "../../engine";
import type { Song } from "../../shared/types";
import { markFor, markName, outStyling, sectionRanges, sectionStyling } from "../lib/sectionMarks";
import { collapseRepeats, parseLabel, passBadge, type PassNote } from "../lib/printRepeats";
import { printFooterCss, printTagline } from "../lib/sheetText";
import { ChordChartRow } from "./ChordChartRow";
import { DiamondOutline } from "./DiamondOutline";

interface Props {
  song: Song;
  soundingKey: string | null;
  shapedKeyName: string;
  /** Printed in the page footer when the sheet is a version of the song. */
  versionName?: string;
}

/** Widest row (chords or lyric) that still fits a two-column layout. */
const TWO_COLUMN_MAX_CHARS = 38;

/**
 * The printable sheet: literal text rows only, never positioned elements,
 * so print alignment is exact by construction. Hidden on screen; print CSS
 * hides the app and shows this. Back-to-back repeats of a section print
 * once, with each pass's dynamics under the label.
 */
export function PrintSheet({ song: written, soundingKey, shapedKeyName, versionName }: Props) {
  const { song, passNotes } = collapseRepeats(written);
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
  const { typeByLine, tacetLines } = sectionStyling(song.lyrics, marks);
  // Sections the player sits out shrink like tacet and carry a pen-style
  // line from an OUT stamp down to a foot where playing resumes.
  const out = outStyling(song.lyrics, song.outSections ?? [], new Set(song.placements.map((p) => p.line)));
  const pairClass = (i: number): string => {
    const type = typeByLine.get(i);
    const small = tacetLines.has(i) || out.lines.has(i);
    return (
      `print-pair${type ? ` sec-${type}` : ""}${small ? " tacet-small" : ""}` +
      `${out.lines.has(i) ? " out" : ""}${out.ends.has(i) ? " out-end" : ""}`
    );
  };
  const outStamp = (labelLine: number) =>
    out.starts.has(labelLine) && <span className="print-out-stamp">OUT</span>;

  return (
    <div className={`print-sheet${twoCol ? "" : " with-sidebar"}`}>
      <style>{printFooterCss(song.title, versionName)}</style>
      {/* Title and tagline only; artist, notes, and version stay off the
          page to leave room for the chart. The footer names the version. */}
      <div className="print-header">
        <h1>{song.title}</h1>
        <span className="print-key">{printTagline(soundingKey, song.capo, song.bpm)}</span>
      </div>
      <div className="print-diagrams">
        <ChordChartRow song={song} shapedKeyName={shapedKeyName} />
      </div>
      <div className={twoCol ? "print-body two-col" : "print-body"}>
        {(() => {
          type Sidebar = {
            line: number;
            title: string;
            /** Times the section plays, from a trailing "x2" on its label. */
            repeat: number;
            mark: ReturnType<typeof markFor>;
            passes?: PassNote[];
          };
          // A highlighted badge so repeats cannot slip past on the stand.
          const repeatBadge = (repeat: number) =>
            repeat > 1 && <span className="print-repeat">{`\u21BB x${repeat}`}</span>;
          // One line per pass, led by a "1st" / "2nd" badge whose color
          // deepens with each time through (capped at the 4th), so passes
          // read apart at a glance. A run like "1st-2nd" takes its first color.
          const passLine = (n: PassNote) => (
            <span key={n.passes} className="print-pass">
              <span className={`print-pass-num pass-${Math.min(parseInt(n.passes, 10), 4)}`}>{passBadge(n.passes)}</span>{" "}
              {markName(n.mark).toUpperCase()}
            </span>
          );
          const body: ReactNode[] = [];
          let pendingSidebar: Sidebar | null = null;
          // Label rows waiting for their first content row. They print in one
          // unbreakable block with it, so a title never ends a page or column.
          let heading: ReactNode[] = [];
          const pushHeading = (node: ReactNode) => heading.push(node);
          const pushContent = (key: React.Key, node: ReactNode) => {
            if (heading.length === 0) {
              body.push(node);
              return;
            }
            body.push(
              <div className="print-keep" key={`keep-${key}`}>
                {heading}
                {node}
              </div>,
            );
            heading = [];
          };

          const compactLabel = (key: React.Key, { line, title, repeat, mark, passes }: Sidebar, start = true) => (
            <div
              className={`${pairClass(line)} print-label-compact${start ? " section-start" : ""}${out.starts.has(line) ? " out-start" : ""}`}
              key={key}
            >
              <pre className="print-lyric">
                {title}
                {repeat > 1 && " "}
                {repeatBadge(repeat)}
                {outStamp(line)}
                {mark && (
                  <span className="print-mark-name">
                    {"  " + markName(mark).toUpperCase()}
                  </span>
                )}
                {passes?.map(passLine)}
              </pre>
            </div>
          );

          const pair = (key: React.Key, i: number, sidebar: Sidebar | null, lyric: string | null, start = false) => {
            const row = rows[i];
            return (
              <div
                className={`${pairClass(i)}${sidebar || start ? " section-start" : ""}${sidebar && out.starts.has(sidebar.line) ? " out-start" : ""}`}
                key={key}
              >
                {sidebar && (
                  <span className="print-side-label">
                    {sidebar.title}
                    {sidebar.repeat > 1 && " "}
                    {repeatBadge(sidebar.repeat)}
                    {outStamp(sidebar.line)}
                    {sidebar.mark && (
                      <span className="print-mark-name">
                        {markName(sidebar.mark).toUpperCase()}
                      </span>
                    )}
                    {sidebar.passes?.map(passLine)}
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
              const label: Sidebar = {
                line: i,
                title: parseLabel(range.label).base,
                repeat: parseLabel(range.label).count,
                mark: markFor(marks, range.label, range.occurrence),
                passes: passNotes.get(i),
              };
              if (pendingSidebar) {
                // Empty section before this one: fall back to a compact row.
                pushHeading(compactLabel(`orphan-${i}`, pendingSidebar));
                pendingSidebar = null;
              }
              if (twoCol) {
                // Chords placed on the label line print above the label.
                if (row.length > 0) pushHeading(pair(`label-chords-${i}`, i, null, null, true));
                pushHeading(compactLabel(i, label, row.length === 0));
              } else if (row.length > 0) {
                // Chords on the label line get their own row, which carries the title.
                pushHeading(pair(i, i, label, null));
              } else {
                // The title leaves the flow and rides the next content pair.
                pendingSidebar = label;
              }
              return;
            }
            if (line.length === 0 && row.length === 0) {
              const gap = <div className={`print-gap${out.lines.has(i) ? " out" : ""}`} key={i} />;
              if (heading.length > 0 || pendingSidebar) pushHeading(gap);
              else body.push(gap);
              return;
            }
            const sidebar = pendingSidebar;
            pendingSidebar = null;
            pushContent(i, pair(i, i, sidebar, line));
          });
          // TS cannot see the callback writes; re-widen before the last check.
          const leftover = pendingSidebar as Sidebar | null;
          if (leftover) {
            heading.push(compactLabel("orphan-end", leftover));
          }
          body.push(...heading);
          return body;
        })()}
      </div>
    </div>
  );
}
