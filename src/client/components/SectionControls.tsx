import { useState } from "react";
import type { Song } from "../../shared/types";
import {
  MAX_REPEAT,
  duplicateSection,
  insertSection,
  moveSection,
  removeSection,
  sectionSummaries,
  setRepeat,
  toBlocks,
  toggleDiamonds,
  toggleOut,
} from "../lib/arrangement";
import { sectionChoices } from "../lib/charts";

interface Props {
  /** The song being edited; the stored song supplies the other charts. */
  stored: Song;
  /** The chart being edited. */
  chart: Song;
  /** Which chart that is: a version's id, or null for the song as written. */
  chartId: string | null;
  index: number;
  onChange(chart: Song): void;
  /** Moves the selection with the section, or clears it (null) after a remove. */
  onSelect(index: number | null): void;
  onClose(): void;
}

/**
 * Every control for one section of the chart being edited, opened from its
 * bubble in the order strip or its tag on the sheet, so the change shows
 * next to the section it acts on.
 */
export function SectionControls({ stored, chart, chartId, index, onChange, onSelect, onClose }: Props) {
  const section = sectionSummaries(chart)[index];
  const choices = sectionChoices(stored, chart, chartId);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const adding = choices.find((c) => c.key === addingKey) ?? choices[0];
  if (!section) return null;

  function move(delta: number) {
    const next = moveSection(chart, index, delta);
    if (next === chart) return;
    onChange(next);
    onSelect(index + delta);
  }

  function remove() {
    onChange(removeSection(chart, index));
    onSelect(null);
  }

  function addAfter() {
    if (!adding) return;
    onChange(insertSection(chart, index + 1, adding.block));
    onSelect(index + 1);
  }

  const last = sectionSummaries(chart).length - 1;

  return (
    <div
      className="step-controls"
      role="dialog"
      aria-label={`${section.title}, section ${index + 1}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="sc-head">
        <span className="arr-num">{index + 1}</span>
        <strong className="sc-title">{section.title}</strong>
        <button className="mini sc-close" title="Close (Esc)" onClick={onClose}>
          &#215;
        </button>
      </div>
      <div className="sc-row">
        <span className="arr-repeat">
          <button
            className="mini"
            disabled={section.repeat <= 1}
            title="Play it fewer times"
            onClick={() => onChange(setRepeat(chart, index, section.repeat - 1))}
          >
            -
          </button>
          <span className={`arr-count${section.repeat > 1 ? "" : " muted"}`}>x{section.repeat}</span>
          <button
            className="mini"
            disabled={section.repeat >= MAX_REPEAT}
            title="Play it more times"
            onClick={() => onChange(setRepeat(chart, index, section.repeat + 1))}
          >
            +
          </button>
        </span>
        <button
          className={`mini arr-out${section.out ? " on" : ""}`}
          aria-pressed={section.out}
          title={section.out ? "You play this section again" : "You sit this section out: it prints small with an OUT stamp"}
          onClick={() => onChange(toggleOut(chart, index))}
        >
          Out
        </button>
        <button
          className={`mini sc-hold${section.diamonds ? " on" : ""}`}
          aria-pressed={section.diamonds}
          title={
            section.diamonds
              ? "Chords go back to plain"
              : "Every chord in this section becomes a diamond (a full-measure hold)"
          }
          disabled={!section.diamonds && toBlocks(chart)[index].chords.length === 0}
          onClick={() => onChange(toggleDiamonds(chart, index))}
        >
          &#9671; Diamonds
        </button>
      </div>
      <div className="sc-row">
        <button className="mini" disabled={index === 0} title="Play it one section earlier" onClick={() => move(-1)}>
          &#8592; Earlier
        </button>
        <button className="mini" disabled={index === last} title="Play it one section later" onClick={() => move(1)}>
          Later &#8594;
        </button>
        <button className="mini" title="Play this section again right after" onClick={() => onChange(duplicateSection(chart, index))}>
          Double
        </button>
        <button className="mini danger sc-remove" title="Remove from this version" onClick={remove}>
          Remove
        </button>
      </div>
      <div className="sc-row">
        <span className="muted">Add after:</span>
        <select
          value={adding?.key ?? ""}
          onChange={(e) => setAddingKey(e.target.value)}
          disabled={choices.length === 0}
          aria-label="Section to copy in after this one"
        >
          {choices.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <button className="mini" disabled={choices.length === 0} onClick={addAfter}>
          Add copy
        </button>
      </div>
    </div>
  );
}
