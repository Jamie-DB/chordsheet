import { useLayoutEffect, useRef, useState } from "react";
import { detectKey, displayChord, isChordSymbol, shapedKey, soundingFromShape } from "../../engine";
import type { Song } from "../../shared/types";
import { buildAiPrompt } from "../lib/aiPrompt";
import { parseImport } from "../lib/exchange";
import { lyricsFromPaste } from "../lib/storage";
import { CapoSuggestions } from "./CapoSuggestions";
import { ImportReviewPanel, PasteReplyModal, type ReviewState } from "./ImportReview";
import { LyricLine, type EditingModel } from "./LyricLine";
import { Toolbar } from "./Toolbar";

interface Props {
  song: Song;
  onBack(): void;
  onChange(song: Song): void;
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

export function Editor({ song, onBack, onChange }: Props) {
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

  const maxColForLine = (line: number) => song.lyrics[line]?.length ?? 0;

  /** Convert typed text (shape space under capo) to the stored sounding symbol. */
  function toSounding(typed: string): string {
    if (song.capo === 0) return typed;
    return soundingFromShape(typed, song.capo, soundingKey ?? "C");
  }

  function toShape(sounding: string): string {
    return displayChord(sounding, song.capo, shaped);
  }

  function commitEdit(text: string) {
    if (!editing) return;
    if (editing.id === null) {
      if (text.length > 0) {
        onChange({
          ...song,
          placements: [
            ...song.placements,
            { id: freshId(), line: editing.line, col: editing.col, chord: toSounding(text) },
          ],
        });
      }
    } else if (text.length === 0) {
      onChange({ ...song, placements: song.placements.filter((p) => p.id !== editing.id) });
    } else {
      onChange({
        ...song,
        placements: song.placements.map((p) =>
          p.id === editing.id ? { ...p, chord: toSounding(text) } : p,
        ),
      });
    }
    setEditing(null);
  }

  function saveLyrics() {
    if (lyricsDraft === null) return;
    const lines = lyricsFromPaste(lyricsDraft);
    let dropped = 0;
    let clamped = 0;
    const placements = song.placements.flatMap((p) => {
      if (p.line >= lines.length) {
        dropped += 1;
        return [];
      }
      const max = lines[p.line].length;
      if (p.col > max) {
        clamped += 1;
        return [{ ...p, col: max }];
      }
      return [p];
    });
    onChange({ ...song, lyrics: lines, placements });
    setLyricsDraft(null);
    setNotice(
      dropped > 0 || clamped > 0
        ? `Lyrics updated. ${dropped} chord(s) lost their line and were removed; ${clamped} moved to a line end. Check placements.`
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
        <button onClick={onBack}>Back to library</button>
        <div className="editor-heading">
          <strong>{song.title}</strong>
          {song.artist && <span className="muted"> {song.artist}</span>}
        </div>
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
      />

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
            Click a spot to add a chord. Click a chord to edit it; drag to move it.
            {song.capo > 0 && ` Entry is in shape space for capo ${song.capo}.`}
          </p>
          {song.lyrics.map((line, i) => (
            <LyricLine
              key={i}
              index={i}
              text={line}
              chips={song.placements
                .filter((p) => p.line === i)
                .sort((a, b) => a.col - b.col)
                .map((p) => ({ id: p.id, col: p.col, label: toShape(p.chord) }))}
              proposals={(review?.fresh ?? [])
                .filter((p) => p.line === i)
                .map((p) => ({ id: p.id, col: p.col, label: toShape(p.chord) }))}
              charWidth={charWidth}
              pairHeight={pairHeight}
              lineCount={song.lyrics.length}
              editing={editing}
              maxColForLine={maxColForLine}
              validate={isChordSymbol}
              onPlace={(line2, col) => setEditing({ line: line2, col, id: null, initial: "" })}
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
                if (p) setEditing({ line: p.line, col: p.col, id, initial: toShape(p.chord) });
              }}
              onCommitEdit={commitEdit}
              onCancelEdit={() => setEditing(null)}
              onAcceptProposal={acceptOne}
            />
          ))}
        </div>
      )}
    </div>
  );
}
