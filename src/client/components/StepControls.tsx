import { useState } from "react";
import type { Arrangement, ArrangementStep, Song } from "../../shared/types";
import {
  MAX_REPEAT,
  arrangeableSections,
  duplicateStep,
  insertStep,
  moveStep,
  removeStep,
  stepTitle,
  updateStep,
} from "../lib/arrangement";

interface Props {
  /** The song as written; sections come from here. */
  song: Song;
  arrangement: Arrangement;
  index: number;
  /** The step's section no longer exists; only Remove is offered. */
  missing: boolean;
  onChange(arrangement: Arrangement): void;
  /** Moves the selection with the step, or clears it (null) after a remove. */
  onSelect(index: number | null): void;
  onClose(): void;
}

/**
 * Every control for one step of a version, opened from its bubble in the
 * order strip or its tag on the sheet, so the change shows next to the
 * section it acts on.
 */
export function StepControls({ song, arrangement, index, missing, onChange, onSelect, onClose }: Props) {
  const steps = arrangement.steps;
  const step = steps[index];
  const addable = arrangeableSections(song).filter((s) => s.hasContent);
  const [adding, setAdding] = useState(0);
  const addIndex = Math.min(adding, Math.max(0, addable.length - 1));
  if (!step) return null;

  const title = stepTitle(step.section, step.occurrence);
  const repeat = step.repeat ?? 1;

  function setSteps(next: ArrangementStep[]) {
    if (next !== steps) onChange({ ...arrangement, steps: next });
  }
  const patch = (p: Partial<ArrangementStep>) => setSteps(updateStep(steps, index, p));

  function move(delta: number) {
    const next = moveStep(steps, index, delta);
    if (next === steps) return;
    setSteps(next);
    onSelect(index + delta);
  }

  function remove() {
    setSteps(removeStep(steps, index));
    onSelect(null);
  }

  function addAfter() {
    const section = addable[addIndex];
    if (!section) return;
    setSteps(insertStep(steps, index + 1, { section: section.section, occurrence: section.occurrence }));
    onSelect(index + 1);
  }

  return (
    <div
      className="step-controls"
      role="dialog"
      aria-label={`${title}, step ${index + 1}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="sc-head">
        <span className="arr-num">{index + 1}</span>
        <strong className="sc-title">{title}</strong>
        <button className="mini sc-close" title="Close (Esc)" onClick={onClose}>
          &#215;
        </button>
      </div>
      {missing ? (
        <div className="sc-row">
          <span className="arr-missing">not in the song anymore</span>
          <button className="mini danger" onClick={remove}>
            Remove
          </button>
        </div>
      ) : (
        <>
          <div className="sc-row">
            <span className="arr-repeat">
              <button className="mini" disabled={repeat <= 1} title="Play it fewer times" onClick={() => patch({ repeat: repeat - 1 })}>
                -
              </button>
              <span className={`arr-count${repeat > 1 ? "" : " muted"}`}>x{repeat}</span>
              <button
                className="mini"
                disabled={repeat >= MAX_REPEAT}
                title="Play it more times"
                onClick={() => patch({ repeat: repeat + 1 })}
              >
                +
              </button>
            </span>
            <button
              className={`mini arr-out${step.out ? " on" : ""}`}
              aria-pressed={Boolean(step.out)}
              title={step.out ? "You play this section again" : "You sit this section out: it prints small with an OUT stamp"}
              onClick={() => patch({ out: !step.out })}
            >
              Out
            </button>
            <button
              className={`mini sc-hold${step.hold ? " on" : ""}`}
              aria-pressed={Boolean(step.hold)}
              title={
                step.hold
                  ? "Chords go back to how the song is written"
                  : "Every chord in this section prints as a diamond (a full-measure hold). The song as written is untouched."
              }
              onClick={() => patch({ hold: !step.hold })}
            >
&#9671; Diamonds
            </button>
          </div>
          <div className="sc-row">
            <input
              className="arr-note"
              value={step.note ?? ""}
              placeholder="cue, e.g. vamp while the pastor speaks"
              onChange={(e) => patch({ note: e.target.value })}
              aria-label={`Cue for ${title}`}
            />
          </div>
          <div className="sc-row">
            <button className="mini" disabled={index === 0} title="Play it one section earlier" onClick={() => move(-1)}>
              &#8592; Earlier
            </button>
            <button
              className="mini"
              disabled={index === steps.length - 1}
              title="Play it one section later"
              onClick={() => move(1)}
            >
              Later &#8594;
            </button>
            <button className="mini" title="Play this section again right after" onClick={() => setSteps(duplicateStep(steps, index))}>
              Double
            </button>
            <button className="mini danger sc-remove" title="Remove from this version" onClick={remove}>
              Remove
            </button>
          </div>
        </>
      )}
      <div className="sc-row">
        <span className="muted">Add after:</span>
        <select
          value={addIndex}
          onChange={(e) => setAdding(Number(e.target.value))}
          disabled={addable.length === 0}
          aria-label="Section to add after this one"
        >
          {addable.map((s, k) => (
            <option key={`${s.section}#${s.occurrence}`} value={k}>
              {s.title}
            </option>
          ))}
        </select>
        <button className="mini" disabled={addable.length === 0} onClick={addAfter}>
          Add
        </button>
      </div>
    </div>
  );
}
