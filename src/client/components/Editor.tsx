import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { detectKey, displayChord, isChordSymbol, shapedKey, soundingFromShape } from "../../engine";
import type { Song } from "../../shared/types";
import { buildAiPrompt } from "../lib/aiPrompt";
import { parseImport } from "../lib/exchange";
import { chordsOnLine, deleteLine, editLine, insertLine } from "../lib/lineOps";
import { normalizeSections } from "../lib/normalize";
import { markColor, markFor, markName, sectionRanges, withMark, withoutMark } from "../lib/sectionMarks";
import { sheetText } from "../lib/sheetText";
import { transposeSong } from "../lib/songOps";
import { lyricsFromPaste } from "../lib/storage";
import { AutoScrollBar } from "./AutoScrollBar";
import { CapoSuggestions } from "./CapoSuggestions";
import { ChordChartRow } from "./ChordChartRow";
import { ImportReviewPanel, PasteReplyModal, type ReviewState } from "./ImportReview";
import { LyricLine, type EditingModel } from "./LyricLine";
import { PrintSheet } from "./PrintSheet";
import { Toolbar } from "./Toolbar";

export interface SetNav {
  setName: string;
  prevTitle: string | null;
  nextTitle: string | null;
  onPrev(): void;
  onNext(): void;
}

interface Props {
  song: Song;
  onBack(): void;
  onChange(song: Song): void;
  setNav?: SetNav;
}

export function songKeyName(song: Song): string | null {
  if (song.keyOverride) return song.keyOverride;
  return detectKey(song.placements.map((p) => p.chord))?.name ?? null;
}

function freshId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `p-${Math.random().toString(36).slice(2, 10)}`;
}

export function Editor({ song, onBack, onChange, setNav }: Props) {
  const detectedKey = detectKey(song.placements.map((p) => p.chord))?.name ?? null;
  const soundingKey = song.keyOverride ?? detectedKey;
  const shaped = soundingKey ? shapedKey(soundingKey, song.capo) : "C";
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [editing, setEditing] = useState<EditingModel | null>(null);
  const [lyricsDraft, setLyricsDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [autoEditLine, setAutoEditLine] = useState<number | null>(null);
  const [markPickerLine, setMarkPickerLine] = useState<number | null>(null);

  const marks = song.sectionMarks ?? [];
  const ranges = sectionRanges(song.lyrics);
  const rangeByStart = new Map(ranges.map((r) => [r.start, r]));
  const sectionClassByLine = new Map<number, string>();
  for (const r of ranges) {
    const mark = markFor(marks, r.label, r.occurrence);
    if (!mark) continue;
    const cls = `sec-${markColor(mark)}`;
    for (let i = r.start; i <= r.end; i++) sectionClassByLine.set(i, cls);
  }
  const [notesOpen, setNotesOpen] = useState(() => Boolean(song.notes?.trim()));

  const bpm = song.bpm ?? 80;

  // Keyboard shortcuts: +/- transpose, Escape closes any open panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement
      ) {
        return;
      }
      if ((e.key === "+" || e.key === "=") && song.placements.length > 0) {
        onChange(transposeSong(song, song.keyOverride ?? detectedKey, 1));
      } else if (e.key === "-" && song.placements.length > 0) {
        onChange(transposeSong(song, song.keyOverride ?? detectedKey, -1));
      } else if (e.key === " ") {
        if (t instanceof HTMLButtonElement) return;
        e.preventDefault();
        setPlaying((v) => !v);
      } else if (e.key === "Escape") {
        setEditing(null);
        setPasteOpen(false);
        setShowSuggestions(false);
        setPlaying(false);
        setMarkPickerLine(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const measureRef = useRef<HTMLSpanElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [charWidth, setCharWidth] = useState(8);
  const [pairHeight, setPairHeight] = useState(44);

  useLayoutEffect(() => {
    if (measureRef.current) {
      const w = measureRef.current.getBoundingClientRect().width / 10;
      if (w > 0) setCharWidth(w);
    }
    const pair = sheetRef.current?.querySelector(".line-pair");
    if (pair instanceof HTMLElement && pair.offsetHeight > 0) setPairHeight(pair.offsetHeight);
  }, [song.lyrics.length, lyricsDraft]);

  // Auto-scroll: one line pair is assumed to span 8 beats (two 4/4 bars).
  useEffect(() => {
    if (!playing) return;
    const pxPerSec = (pairHeight * bpm) / 60 / 8;
    let raf = 0;
    let last = performance.now();
    let carry = 0;
    const step = (now: number) => {
      carry += pxPerSec * ((now - last) / 1000);
      last = now;
      const px = Math.floor(carry);
      if (px >= 1) {
        window.scrollBy(0, px);
        carry -= px;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, bpm, pairHeight]);

  // Chords may sit past the end of any line (between-phrase progressions),
  // so every lane is interactive out to the song's grid width.
  const gridCols = Math.max(50, ...song.lyrics.map((l) => l.length));
  const maxColForLine = (_line: number) => gridCols;

  /** Convert typed text (shape space under capo) to the stored sounding symbol. */
  function toSounding(typed: string): string {
    if (song.capo === 0) return typed;
    return soundingFromShape(typed, song.capo, soundingKey ?? "C");
  }

  function toShape(sounding: string): string {
    return displayChord(sounding, song.capo, shaped);
  }

  function commitEdit(text: string, hold: boolean) {
    if (!editing) return;
    if (editing.id === null) {
      if (text.length > 0) {
        onChange({
          ...song,
          placements: [
            ...song.placements,
            {
              id: freshId(),
              line: editing.line,
              col: editing.col,
              chord: toSounding(text),
              ...(hold ? { hold: true } : {}),
            },
          ],
        });
      }
    } else if (text.length === 0) {
      onChange({ ...song, placements: song.placements.filter((p) => p.id !== editing.id) });
    } else {
      onChange({
        ...song,
        placements: song.placements.map((p) =>
          p.id === editing.id ? { ...p, chord: toSounding(text), hold: hold || undefined } : p,
        ),
      });
    }
    setEditing(null);
  }

  function saveLyrics() {
    if (lyricsDraft === null) return;
    const lines = lyricsFromPaste(lyricsDraft);
    let dropped = 0;
    const kept = song.placements.filter((p) => {
      if (p.line >= lines.length) {
        dropped += 1;
        return false;
      }
      return true;
    });
    const normalized = normalizeSections(lines, kept);
    onChange({ ...song, lyrics: normalized.lyrics, placements: normalized.placements });
    setLyricsDraft(null);
    setNotice(
      dropped > 0
        ? `Lyrics updated. ${dropped} chord(s) lost their line and were removed. Check placements.`
        : null,
    );
  }

  const longLines = song.lyrics.filter((l) => l.length > 90).length;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(buildAiPrompt(song));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setNotice("Could not write to the clipboard. Copy from the browser permission prompt or try again.");
    }
  }

  /** Returns an error message, or null when the reply imported cleanly. */
  function submitReply(text: string): string | null {
    const result = parseImport(text, song);
    if (!result.ok) return result.error;
    const fresh = result.song.placements.filter(
      (p) => !song.placements.some((e) => e.line === p.line && e.col === p.col && e.chord === p.chord),
    );
    setReview({
      proposals: result.song.placements,
      fresh,
      unresolved: result.unresolved,
      lyricsRejected: result.lyricsRejected,
    });
    setPasteOpen(false);
    return null;
  }

  function acceptAll() {
    if (!review) return;
    onChange({ ...song, placements: review.proposals });
    setReview(null);
  }

  function acceptLine(line: number) {
    if (!review) return;
    onChange({
      ...song,
      placements: [
        ...song.placements.filter((p) => p.line !== line),
        ...review.proposals.filter((p) => p.line === line),
      ],
    });
    const fresh = review.fresh.filter((p) => p.line !== line);
    setReview(fresh.length > 0 ? { ...review, fresh } : null);
  }

  function acceptOne(id: string) {
    if (!review) return;
    const proposal = review.fresh.find((p) => p.id === id);
    if (!proposal) return;
    onChange({ ...song, placements: [...song.placements, proposal] });
    const fresh = review.fresh.filter((p) => p.id !== id);
    setReview(fresh.length > 0 ? { ...review, fresh } : null);
  }

  return (
    <div className="editor">
      <div className="editor-bar">
        <button onClick={onBack}>{setNav ? "Back to set" : "Back to library"}</button>
        <div className="editor-heading">
          <strong>{song.title}</strong>
          {song.artist && <span className="muted"> {song.artist}</span>}
          {setNav && <span className="badge">{setNav.setName}</span>}
        </div>
        {setNav && (
          <span className="set-nav">
            <button disabled={setNav.prevTitle === null} onClick={setNav.onPrev} title={setNav.prevTitle ?? undefined}>
              &#8592; Prev
            </button>
            <button disabled={setNav.nextTitle === null} onClick={setNav.onNext}>
              {setNav.nextTitle ? `Next: ${setNav.nextTitle}` : "Next"} &#8594;
            </button>
          </span>
        )}
        {lyricsDraft === null ? (
          <>
            <button onClick={() => void copyPrompt()}>{copied ? "Copied" : "Copy AI prompt"}</button>
            <button onClick={() => setPasteOpen(true)}>Paste AI reply</button>
            <button onClick={() => setLyricsDraft(song.lyrics.join("\n"))}>Edit lyrics</button>
          </>
        ) : (
          <>
            <button className="primary" onClick={saveLyrics}>Save lyrics</button>
            <button onClick={() => setLyricsDraft(null)}>Cancel</button>
          </>
        )}
      </div>

      <Toolbar
        song={song}
        soundingKey={soundingKey}
        detectedKey={detectedKey}
        onChange={onChange}
        onToggleSuggestions={() => setShowSuggestions((v) => !v)}
        showingSuggestions={showSuggestions}
        onPrint={() => window.print()}
        copiedText={copiedText}
        onCopyText={() => {
          void navigator.clipboard
            .writeText(sheetText(song, soundingKey, shaped))
            .then(() => {
              setCopiedText(true);
              setTimeout(() => setCopiedText(false), 2500);
            })
            .catch(() => setNotice("Could not write to the clipboard."));
        }}
      />

      <PrintSheet song={song} soundingKey={soundingKey} shapedKeyName={shaped} />

      {showSuggestions && soundingKey && (
        <CapoSuggestions
          song={song}
          soundingKey={soundingKey}
          onApply={(fret) => {
            onChange({ ...song, capo: fret });
            setShowSuggestions(false);
          }}
        />
      )}

      {notice && (
        <p className="status" role="status">
          {notice} <button className="mini" onClick={() => setNotice(null)}>Dismiss</button>
        </p>
      )}
      {longLines > 0 && (
        <p className="status">
          {longLines} line(s) exceed 90 characters and may not fit a printed page.
        </p>
      )}

      {lyricsDraft === null && (
        <details
          className="notes-panel"
          open={notesOpen}
          onToggle={(e) => setNotesOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary>Notes</summary>
          <textarea
            rows={3}
            value={song.notes ?? ""}
            placeholder="Tuning, strum pattern, reminders. Prints under the header."
            onChange={(e) => onChange({ ...song, notes: e.target.value || undefined })}
            aria-label="Song notes"
          />
        </details>
      )}

      {song.placements.length > 0 && lyricsDraft === null && (
        <details className="chord-panel" open>
          <summary>Chords</summary>
          <ChordChartRow song={song} shapedKeyName={shaped} />
        </details>
      )}

      {review && (
        <ImportReviewPanel
          review={review}
          renderChord={toShape}
          onAcceptAll={acceptAll}
          onAcceptLine={acceptLine}
          onDiscard={() => setReview(null)}
        />
      )}
      {pasteOpen && <PasteReplyModal onSubmit={submitReply} onClose={() => setPasteOpen(false)} />}

      {lyricsDraft !== null ? (
        <textarea
          className="lyrics-editor"
          value={lyricsDraft}
          rows={Math.max(10, song.lyrics.length + 2)}
          onChange={(e) => setLyricsDraft(e.target.value)}
          aria-label="Lyrics"
        />
      ) : (
        <div className="sheet" ref={sheetRef}>
          <span className="measure" ref={measureRef} aria-hidden>
            {"0".repeat(10)}
          </span>
          <p className="sheet-hint muted">
            Click a spot to add a chord. Click a chord to edit it; drag to move it. Double-click a
            line to edit its words; hover the left edge for line tools.
            {song.capo > 0 && ` Entry is in shape space for capo ${song.capo}.`}
          </p>
          <AutoScrollBar
            bpm={bpm}
            playing={playing}
            onToggle={() => setPlaying((v) => !v)}
            onBpm={(next) => onChange({ ...song, bpm: next })}
          />
          {song.lyrics.map((line, i) => (
            <LyricLine
              key={i}
              index={i}
              text={line}
              chips={song.placements
                .filter((p) => p.line === i)
                .sort((a, b) => a.col - b.col)
                .map((p) => ({ id: p.id, col: p.col, label: toShape(p.chord), hold: p.hold === true }))}
              proposals={(review?.fresh ?? [])
                .filter((p) => p.line === i)
                .map((p) => ({ id: p.id, col: p.col, label: toShape(p.chord), hold: p.hold === true }))}
              charWidth={charWidth}
              pairHeight={pairHeight}
              lineCount={song.lyrics.length}
              editing={editing}
              maxColForLine={maxColForLine}
              validate={isChordSymbol}
              onPlace={(line2, col) =>
                setEditing({ line: line2, col, id: null, initial: "", initialHold: false })
              }
              onCommitMove={(id, line2, col) =>
                onChange({
                  ...song,
                  placements: song.placements.map((p) =>
                    p.id === id ? { ...p, line: line2, col } : p,
                  ),
                })
              }
              onOpenEdit={(id) => {
                const p = song.placements.find((pl) => pl.id === id);
                if (p) {
                  setEditing({
                    line: p.line,
                    col: p.col,
                    id,
                    initial: toShape(p.chord),
                    initialHold: p.hold === true,
                  });
                }
              }}
              onCommitEdit={commitEdit}
              onCancelEdit={() => setEditing(null)}
              onAcceptProposal={acceptOne}
              autoEdit={autoEditLine === i}
              onAutoEditConsumed={() => setAutoEditLine(null)}
              onCommitLine={(line2, text) => onChange(editLine(song, line2, text))}
              onInsertLine={(at) => {
                onChange(insertLine(song, at));
                setAutoEditLine(at);
              }}
              onDeleteLine={(line2) => {
                const n = chordsOnLine(song, line2);
                if (n > 0 && !window.confirm(`Delete this line and its ${n} chord(s)?`)) return;
                onChange(deleteLine(song, line2));
              }}
              sectionClass={sectionClassByLine.get(i)}
              sectionUi={(() => {
                const range = rangeByStart.get(i);
                if (!range) return undefined;
                const current = markFor(marks, range.label, range.occurrence);
                return {
                  pillName: current ? markName(current) : null,
                  pillColor: current ? markColor(current) : null,
                  pickerOpen: markPickerLine === i,
                  current,
                  onOpen: () => setMarkPickerLine(i),
                  onPick: (kind, text, color) => {
                    const next = withMark(marks, {
                      section: range.label,
                      occurrence: range.occurrence,
                      kind,
                      ...(kind === "custom" ? { text, color } : {}),
                    });
                    onChange({ ...song, sectionMarks: next });
                    setMarkPickerLine(null);
                  },
                  onClear: () => {
                    const next = withoutMark(marks, range.label, range.occurrence);
                    onChange({ ...song, sectionMarks: next.length > 0 ? next : undefined });
                    setMarkPickerLine(null);
                  },
                  onClose: () => setMarkPickerLine(null),
                };
              })()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
