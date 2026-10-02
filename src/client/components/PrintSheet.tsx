import { Fragment, type ReactNode } from "react";
import { buildChordRowSegments, displayChord } from "../../engine";
import type { Song } from "../../shared/types";
import { markFor, markName, outStyling, sectionRanges, sectionStyling } from "../lib/sectionMarks";
import { collapseRepeats, parseLabel, passBadge, type PassNote } from "../lib/printRepeats";
import { capoBadge, printFooterCss, printTagline } from "../lib/sheetText";
import { wrapLine } from "../lib/printWrap";
import { ChordChartRow } from "./ChordChartRow";
import { DiamondOutline } from "./DiamondOutline";

interface Props {
  song: Song;
  soundingKey: string | null;
  shapedKeyName: string;
  /** Printed in the page footer when the sheet is a version of the song. */
  versionName?: string;
  /** The chord diagram row under the title. */
  showDiagrams?: boolean;
  /**
   * One song among several in a set print: no footer of its own (the set
   * sets one), the version named beside the title, and a rule above it.
   */
  inSet?: boolean;
}

/** Widest row (chords or lyric) that fits a column; longer lines wrap. */
const COLUMN_CHARS = 38;
/** Continuation rows of a wrapped line hang this many columns in. */
const WRAP_INDENT = 2;

/**
 * The printable sheet: literal text rows only, never positioned elements,
 * so print alignment is exact by construction. Hidden on screen; print CSS
 * hides the app and shows this. Back-to-back repeats of a section print
 * once, with each pass's dynamics under the label. Blank lines are left
 * out (section gaps separate sections) and lines too wide for a column wrap.
 */
export function PrintSheet({ song: written, soundingKey, shapedKeyName, versionName, showDiagrams = true, inSet = false }: Props) {
  const { song, passNotes } = collapseRepeats(written);
  const marks = song.sectionMarks ?? [];
  const ranges = sectionRanges(song.lyrics);
  const rangeByStart = new Map(ranges.map((r) => [r.start, r]));
  // A label line's own text is replaced by the title, so only its chords wrap.
  const wrapped = song.lyrics.map((lyric, i) =>
    wrapLine(
      rangeByStart.has(i) ? "" : lyric,
      song.placements.filter((p) => p.line === i),
      (chord) => displayChord(chord, song.capo, shapedKeyName),
      COLUMN_CHARS,
      WRAP_INDENT,
    ),
  );
  const rowSegments = (placements: Song["placements"]) =>
    buildChordRowSegments(placements, (chord) => displayChord(chord, song.capo, shapedKeyName));
  const hasChords = (i: number) => wrapped[i].some((r) => r.placements.length > 0);

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

  const title = inSet && versionName?.trim() ? `${song.title} (${versionName.trim()})` : song.title;

  return (
    <div className={`print-sheet${inSet ? " in-set" : ""}`}>
      {!inSet && <style>{printFooterCss(song.title, versionName)}</style>}
      {/* Title and tagline only; artist, notes, and version stay off the
          page to leave room for the chart. The footer names the version. */}
      <div className="print-header">
        <h1>{title}</h1>
        {capoBadge(song.capo) && <span className="print-capo">{capoBadge(song.capo)}</span>}
        <span className="print-key">{printTagline(soundingKey, song.bpm)}</span>
      </div>
      {showDiagrams && (
        <div className="print-diagrams">
          <ChordChartRow song={song} shapedKeyName={shapedKeyName} />
        </div>
      )}
      <div className="print-body two-col">
        {(() => {
          type Label = {
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
          // Label rows waiting for their first content row. They print in one
          // unbreakable block with it, so a title never ends a page or column.
          let heading: ReactNode[] = [];
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

          const compactLabel = (key: React.Key, { line, title, repeat, mark, passes }: Label, start = true) => (
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

          /** A line's chord and lyric rows, wrapped rows kept in one block. */
          const pair = (key: React.Key, i: number, showLyric: boolean, start = false) => (
            <div className={`${pairClass(i)}${start ? " section-start" : ""}`} key={key}>
              {wrapped[i].map((r, k) => {
                const segments = rowSegments(r.placements);
                return (
                  <Fragment key={k}>
                    {segments.length > 0 && (
                      <pre className="print-chords">
                        {segments.map((s, j) =>
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
                    {showLyric && <pre className="print-lyric">{r.lyric || " "}</pre>}
                  </Fragment>
                );
              })}
            </div>
          );

          song.lyrics.forEach((line, i) => {
            const range = rangeByStart.get(i);
            if (range) {
              const label: Label = {
                line: i,
                title: parseLabel(range.label).base,
                repeat: parseLabel(range.label).count,
                mark: markFor(marks, range.label, range.occurrence),
                passes: passNotes.get(i),
              };
              const chorded = hasChords(i);
              // Chords placed on the label line print above the label.
              if (chorded) heading.push(pair(`label-chords-${i}`, i, false, true));
              heading.push(compactLabel(i, label, !chorded));
              return;
            }
            if (line.length === 0 && !hasChords(i)) return;
            pushContent(i, pair(i, i, true));
          });
          body.push(...heading);
          return body;
        })()}
      </div>
    </div>
  );
}
