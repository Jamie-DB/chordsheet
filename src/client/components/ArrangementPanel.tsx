import { useState } from "react";
import type { Song } from "../../shared/types";
import { insertSection, sectionSummaries } from "../lib/arrangement";
import { sectionChoices } from "../lib/charts";
import { sectionType } from "../lib/sectionMarks";
import { SectionControls } from "./SectionControls";

/** Which section's controls are open, and where: its bubble here, or its tag on the sheet. */
export interface SectionSelection {
  index: number;
  from: "strip" | "sheet";
}

interface Props {
  /** The song being edited; the stored song supplies the other charts. */
  stored: Song;
  /** The chart being edited. */
  chart: Song;
  chartId: string | null;
  /** The name shown for the chart: a version's name, or "As written". */
  chartName: string;
  /** Bubbles and sheet tags open section controls only while editing. */
  editing: boolean;
  onToggleEditing(): void;
  selected: SectionSelection | null;
  onSelect(selection: SectionSelection | null): void;
  onChange(chart: Song): void;
}

/**
 * The order of the chart being edited as a strip of section bubbles. Each
 * bubble shows its repeats, OUT, and diamonds at a glance; in edit mode a
 * click opens that one section's controls.
 */
export function ArrangementPanel({ stored, chart, chartId, chartName, editing, onToggleEditing, selected, onSelect, onChange }: Props) {
  const sections = sectionSummaries(chart);
  const choices = sectionChoices(stored, chart, chartId);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const adding = choices.find((c) => c.key === addingKey) ?? choices[0];

  function addAtEnd() {
    if (!adding) return;
    onChange(insertSection(chart, sections.length, adding.block));
    onSelect({ index: sections.length, from: "strip" });
  }

  return (
    <section className={`arrangement-panel${editing ? " editing" : ""}`} aria-label={`Order of ${chartName}`}>
      <div className="arr-head">
        <span className="toolbar-label">Order</span>
        <ol className="arr-strip">
          {sections.map((section, i) => {
            const type = section.labelLine === null ? "other" : sectionType(chart.lyrics[section.labelLine]);
            const isSelected = selected?.index === i;
            const className =
              `arr-bubble pill-${type}` + `${section.out ? " out" : ""}${isSelected ? " selected" : ""}`;
            const body = (
              <>
                <span className="arr-bubble-num">{i + 1}</span>
                {section.title}
                {section.repeat > 1 && <span className="arr-bubble-x">x{section.repeat}</span>}
                {section.diamonds && (
                  <span className="arr-bubble-hold" title="Diamonds">
                    &#9671;
                  </span>
                )}
                {section.out && <span className="tag-out">OUT</span>}
              </>
            );
            return (
              <li key={i}>
                {editing ? (
                  <button
                    className={className}
                    aria-pressed={isSelected}
                    title={`Controls for ${section.title}`}
                    onClick={() => onSelect(isSelected ? null : { index: i, from: "strip" })}
                  >
                    {body}
                  </button>
                ) : (
                  <span className={className}>{body}</span>
                )}
              </li>
            );
          })}
          {sections.length === 0 && <li className="muted arr-empty">No sections yet.</li>}
        </ol>
        <button className={`mini arr-edit${editing ? " primary" : ""}`} onClick={onToggleEditing}>
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      {editing && selected?.from === "strip" && (
        <SectionControls
          stored={stored}
          chart={chart}
          chartId={chartId}
          index={selected.index}
          onChange={onChange}
          onSelect={(index) => onSelect(index === null ? null : { index, from: "strip" })}
          onClose={() => onSelect(null)}
        />
      )}

      {editing && (
        <div className="arr-foot">
          <span className="muted arr-hint">Click a bubble here or a section tag on the sheet for its controls.</span>
          <select
            value={adding?.key ?? ""}
            onChange={(e) => setAddingKey(e.target.value)}
            disabled={choices.length === 0}
            aria-label="Section to copy in at the end"
          >
            {choices.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <button className="mini" disabled={choices.length === 0} onClick={addAtEnd}>
            Add copy at end
          </button>
        </div>
      )}
    </section>
  );
}
