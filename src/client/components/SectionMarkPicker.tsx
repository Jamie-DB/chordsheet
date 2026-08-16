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

export function SectionMarkPicker({ col, current, onPick, onClear, onClose }: Props) {
  const [customText, setCustomText] = useState(current?.kind === "custom" ? (current.text ?? "") : "");
  const [customColor, setCustomColor] = useState<MarkColor>(
    current?.kind === "custom" ? (current.color ?? "amber") : "amber",
  );

  return (
    <span className="chord-popover mark-picker" style={{ left: `${col}ch` }} onClick={(e) => e.stopPropagation()}>
      {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((kind) => (
        <button
          key={kind}
          className={`mini mark-btn mark-${PRESETS[kind].color}`}
          onClick={() => onPick(kind)}
          title={`${PRESETS[kind].name} section`}
        >
          {PRESETS[kind].name}
        </button>
      ))}
      <span className="mark-custom">
        <input
          value={customText}
          size={7}
          placeholder="custom"
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && customText.trim()) onPick("custom", customText.trim(), customColor);
            if (e.key === "Escape") onClose();
          }}
        />
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
          disabled={!customText.trim()}
          onClick={() => onPick("custom", customText.trim(), customColor)}
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
