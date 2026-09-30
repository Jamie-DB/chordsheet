import { useState } from "react";
import type { Arrangement, Song } from "../../shared/types";
import { OPENING, arrangeableSections, defaultSteps, stepTitle } from "../lib/arrangement";
import { sectionType } from "../lib/sectionMarks";
import { StepControls } from "./StepControls";

/** Which step's controls are open, and where: its bubble here, or its tag on the sheet. */
export interface StepSelection {
  index: number;
  from: "strip" | "sheet";
}

interface Props {
  /** The song as written; sections come from here. */
  song: Song;
  arrangement: Arrangement;
  /** Indices of steps whose section no longer exists. */
  missing: number[];
  /** Bubbles and sheet tags open step controls only while editing. */
  editing: boolean;
  onToggleEditing(): void;
  selected: StepSelection | null;
  onSelect(selection: StepSelection | null): void;
  onChange(arrangement: Arrangement): void;
}

/**
 * The order of one version as a strip of section bubbles. Each bubble shows
 * its repeats, OUT, and diamonds at a glance; in edit mode a click opens
 * that one step's controls.
 */
export function ArrangementPanel({
  song,
  arrangement,
  missing,
  editing,
  onToggleEditing,
  selected,
  onSelect,
  onChange,
}: Props) {
  const steps = arrangement.steps;
  const missingSet = new Set(missing);
  const addable = arrangeableSections(song).filter((s) => s.hasContent);
  const [adding, setAdding] = useState(0);
  const addIndex = Math.min(adding, Math.max(0, addable.length - 1));

  function addAtEnd() {
    const section = addable[addIndex];
    if (!section) return;
    onChange({ ...arrangement, steps: [...steps, { section: section.section, occurrence: section.occurrence }] });
    onSelect({ index: steps.length, from: "strip" });
  }

  return (
    <section className={`arrangement-panel${editing ? " editing" : ""}`} aria-label={`Order of ${arrangement.name}`}>
      <div className="arr-head">
        <span className="toolbar-label">Order</span>
        <ol className="arr-strip">
          {steps.map((step, i) => {
            const title = stepTitle(step.section, step.occurrence);
            const repeat = step.repeat ?? 1;
            const isMissing = missingSet.has(i);
            const type = step.section === OPENING ? "other" : sectionType(step.section);
            const isSelected = selected?.index === i;
            const className =
              `arr-bubble pill-${type}` +
              `${step.out ? " out" : ""}${isMissing ? " missing" : ""}${isSelected ? " selected" : ""}`;
            const body = (
              <>
                <span className="arr-bubble-num">{i + 1}</span>
                {title}
                {repeat > 1 && <span className="arr-bubble-x">x{repeat}</span>}
                {step.hold && (
                  <span className="arr-bubble-hold" title="Diamonds">
                    &#9671;
                  </span>
                )}
                {step.out && <span className="tag-out">OUT</span>}
              </>
            );
            return (
              <li key={i}>
                {editing ? (
                  <button
                    className={className}
                    aria-pressed={isSelected}
                    title={isMissing ? `${title} is not in the song anymore` : `Controls for ${title}`}
                    onClick={() => onSelect(isSelected ? null : { index: i, from: "strip" })}
                  >
                    {body}
                  </button>
                ) : (
                  <span className={className} title={isMissing ? `${title} is not in the song anymore` : undefined}>
                    {body}
                  </span>
                )}
              </li>
            );
          })}
          {steps.length === 0 && <li className="muted arr-empty">No sections yet.</li>}
        </ol>
        <button className={`mini arr-edit${editing ? " primary" : ""}`} onClick={onToggleEditing}>
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      {editing && selected?.from === "strip" && (
        <StepControls
          song={song}
          arrangement={arrangement}
          index={selected.index}
          missing={missingSet.has(selected.index)}
          onChange={onChange}
          onSelect={(index) => onSelect(index === null ? null : { index, from: "strip" })}
          onClose={() => onSelect(null)}
        />
      )}

      {editing && (
        <div className="arr-foot">
          <span className="muted arr-hint">Click a bubble here or a section tag on the sheet for its controls.</span>
          <select
            value={addIndex}
            onChange={(e) => setAdding(Number(e.target.value))}
            disabled={addable.length === 0}
            aria-label="Section to add at the end"
          >
            {addable.map((s, k) => (
              <option key={`${s.section}#${s.occurrence}`} value={k}>
                {s.title}
              </option>
            ))}
          </select>
          <button className="mini" disabled={addable.length === 0} onClick={addAtEnd}>
            Add at end
          </button>
          <button
            className="mini arr-reset"
            onClick={() => {
              if (window.confirm("Reset this version to the song as written? Its order, repeats, cues, marks, outs, and diamonds are cleared.")) {
                onChange({ ...arrangement, steps: defaultSteps(song) });
                onSelect(null);
              }
            }}
          >
            Reset to as written
          </button>
        </div>
      )}
    </section>
  );
}
