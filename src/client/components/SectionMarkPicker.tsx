import { useState } from "react";
import type { MarkKind, SectionMark } from "../../shared/types";
import { PRESETS } from "../lib/sectionMarks";

interface Props {
  col: number;
  current: SectionMark | null;
  onPick(kind: MarkKind, text?: string): void;
  onClear(): void;
  onClose(): void;
}

/**
 * Term and behavior are separate: a preset button gives behavior (Tacet
 * shrinks the section); the note field, when filled, replaces the preset's
 * word on the tag. Set makes a plain note. Colors belong to the section
 * type, never to the mark.
 */
export function SectionMarkPicker({ col, current, onPick, onClear, onClose }: Props) {
  const [note, setNote] = useState(current?.text ?? "");
  const trimmed = note.trim();

  return (
    <span className="chord-popover mark-picker" style={{ left: `${col}ch` }} onClick={(e) => e.stopPropagation()}>
      <input
        value={note}
        size={16}
        placeholder="note (replaces the term)"
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      />
      {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((kind) => (
        <button
          key={kind}
          className="mini mark-btn"
          onClick={() => onPick(kind, trimmed || undefined)}
          title={`${PRESETS[kind].name}${trimmed ? `, shown as "${trimmed}"` : ""}`}
        >
          {PRESETS[kind].name}
        </button>
      ))}
      <button
        className="mini"
        disabled={!trimmed}
        onClick={() => onPick("custom", trimmed)}
        title="Just the note, no preset behavior"
      >
        Set
      </button>
      {current && (
        <button className="mini danger" onClick={onClear}>
          Clear
        </button>
      )}
      <button className="mini" onClick={onClose}>
        Esc
      </button>
    </span>
  );
}
