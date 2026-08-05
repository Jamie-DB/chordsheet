import { useEffect, useRef, useState } from "react";
import type { ChordPlacement } from "../../shared/types";
import type { UnresolvedPlacement } from "../lib/exchange";

export interface ReviewState {
  /** The reply's full placement set, resolved to columns (sounding chords). */
  proposals: ChordPlacement[];
  /** Proposals that differ from existing placements; these render as chips. */
  fresh: ChordPlacement[];
  unresolved: UnresolvedPlacement[];
  lyricsRejected: boolean;
}

interface PanelProps {
  review: ReviewState;
  renderChord(sounding: string): string;
  onAcceptAll(): void;
  onAcceptLine(line: number): void;
  onDiscard(): void;
}

export function ImportReviewPanel({ review, renderChord, onAcceptAll, onAcceptLine, onDiscard }: PanelProps) {
  const lines = [...new Set(review.fresh.map((p) => p.line))].sort((a, b) => a - b);
  return (
    <div className="review-panel">
      <div className="review-head">
        <strong>
          {review.fresh.length} proposed chord{review.fresh.length === 1 ? "" : "s"}
        </strong>
        <span className="muted"> Click a chip to accept it one at a time, or:</span>
        <button className="primary" onClick={onAcceptAll}>
          Accept all (replaces current placements)
        </button>
        <button onClick={onDiscard}>Discard</button>
      </div>
      {review.lyricsRejected && (
        <p className="status">The reply tried to change lyrics; those changes were rejected. Only placements are considered.</p>
      )}
      {lines.length > 0 && (
        <ul className="review-lines">
          {lines.map((line) => (
            <li key={line}>
              line {line + 1}:{" "}
              {review.fresh
                .filter((p) => p.line === line)
                .sort((a, b) => a.col - b.col)
                .map((p) => renderChord(p.chord))
                .join("  ")}{" "}
              <button className="mini" onClick={() => onAcceptLine(line)}>
                Accept line
              </button>
            </li>
          ))}
        </ul>
      )}
      {review.unresolved.length > 0 && (
        <div className="review-unresolved">
          <strong>Could not resolve:</strong>
          <ul>
            {review.unresolved.map((u, i) => (
              <li key={i}>
                {u.chord} ({u.reason})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface PasteProps {
  onSubmit(text: string): string | null;
  onClose(): void;
}

export function PasteReplyModal({ onSubmit, onClose }: PasteProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => ref.current?.focus(), []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Paste the AI reply</h3>
        <p className="muted">
          Paste the JSON Claude returned. Only the placements array will be read; lyric changes are rejected.
        </p>
        <textarea
          ref={ref}
          rows={12}
          value={text}
          placeholder='{"version": 1, ...}'
          onChange={(e) => setText(e.target.value)}
        />
        {error && <p className="status">{error}</p>}
        <div className="modal-actions">
          <button
            className="primary"
            onClick={() => {
              const err = onSubmit(text);
              if (err) setError(err);
            }}
          >
            Import
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
