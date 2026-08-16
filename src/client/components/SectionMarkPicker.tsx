import { useState } from "react";
import type { MarkColor, MarkKind, SectionMark } from "../../shared/types";
import { MARK_COLORS, PRESETS } from "../lib/sectionMarks";

interface Props {
  col: number;
  current: SectionMark | null;
  onPick(kind: MarkKind, text?: string, color?: MarkColor): void;
  onClear(): void;
  onClose(): void;
}

/**
 * Style and term are separate: a preset button gives color and behavior
 * (Tacet shrinks the section); the note field, when filled, replaces the
 * preset's word on the tag. The color dots plus Set make a custom mark.
 */
export function SectionMarkPicker({ col, current, onPick, onClear, onClose }: Props) {
  const [note, setNote] = useState(current?.text ?? "");
  const [customColor, setCustomColor] = useState<MarkColor>(
    current?.kind === "custom" ? (current.color ?? "amber") : "amber",
  );
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
          className={`mini mark-btn mark-${PRESETS[kind].color}`}
          onClick={() => onPick(kind, trimmed || undefined)}
          title={`${PRESETS[kind].name} behavior and color${trimmed ? `, shown as "${trimmed}"` : ""}`}
        >
          {PRESETS[kind].name}
        </button>
      ))}
      <span className="mark-custom">
        {MARK_COLORS.map((color) => (
          <button
            key={color}
            className={`mark-dot dot-${color}${customColor === color ? " selected" : ""}`}
            onClick={() => setCustomColor(color)}
            title={color}
            aria-label={`custom color ${color}`}
          />
        ))}
        <button
          className="mini"
          disabled={!trimmed}
          onClick={() => onPick("custom", trimmed, customColor)}
          title="Just the note in the chosen color, no preset behavior"
        >
          Set
        </button>
      </span>
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
