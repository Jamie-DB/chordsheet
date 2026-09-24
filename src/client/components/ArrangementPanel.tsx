import { useState } from "react";
import type { Arrangement, ArrangementStep, MarkKind, Song } from "../../shared/types";
import {
  MAX_REPEAT,
  arrangeableSections,
  defaultSteps,
  duplicateStep,
  moveStep,
  removeStep,
  stepTitle,
  updateStep,
} from "../lib/arrangement";
import { PRESETS, markName } from "../lib/sectionMarks";
import { inheritedMark, markChoice, markFromChoice, type MarkChoice } from "../lib/versions";

interface Props {
  /** The song as written; sections come from here. */
  song: Song;
  arrangement: Arrangement;
  /** Indices of steps whose section no longer exists. */
  missing: number[];
  onChange(arrangement: Arrangement): void;
}

const PRESET_KINDS = Object.keys(PRESETS) as Array<Exclude<MarkKind, "custom">>;

/** The ordered steps of one version: repeats, cues, marks, and order. */
export function ArrangementPanel({ song, arrangement, missing, onChange }: Props) {
  const steps = arrangement.steps;
  const missingSet = new Set(missing);
  const addable = arrangeableSections(song).filter((s) => s.hasContent);
  const [adding, setAdding] = useState(0);
  const addIndex = Math.min(adding, Math.max(0, addable.length - 1));

  function setSteps(next: ArrangementStep[]) {
    if (next !== steps) onChange({ ...arrangement, steps: next });
  }

  function add() {
    const section = addable[addIndex];
    if (!section) return;
    setSteps([...steps, { section: section.section, occurrence: section.occurrence }]);
  }

  return (
    <section className="arrangement-panel" aria-label={`Order of ${arrangement.name}`}>
      {steps.length === 0 && <p className="muted arr-empty">No sections yet. Add one below.</p>}
      <ol className="arr-steps">
        {steps.map((step, i) => {
          const title = stepTitle(step.section, step.occurrence);
          const remove = (
            <button className="mini danger" title="Remove from this version" onClick={() => setSteps(removeStep(steps, i))}>
              &#215;
            </button>
          );
          if (missingSet.has(i)) {
            return (
              <li key={i} className="arr-step missing">
                <span className="arr-num">{i + 1}</span>
                <span className="arr-title">{title}</span>
                <span className="arr-missing">not in the song anymore</span>
                <span className="arr-tools">{remove}</span>
              </li>
            );
          }
          const repeat = step.repeat ?? 1;
          const inherited = inheritedMark(song, step);
          return (
            <li key={i} className="arr-step">
              <span className="arr-num">{i + 1}</span>
              <span className="arr-title">{title}</span>
              <span className="arr-repeat">
                <button
                  className="mini"
                  disabled={repeat <= 1}
                  title="Play it fewer times"
                  onClick={() => setSteps(updateStep(steps, i, { repeat: repeat - 1 }))}
                >
                  -
                </button>
                <span className={`arr-count${repeat > 1 ? "" : " muted"}`}>x{repeat}</span>
                <button
                  className="mini"
                  disabled={repeat >= MAX_REPEAT}
                  title="Play it more times"
                  onClick={() => setSteps(updateStep(steps, i, { repeat: repeat + 1 }))}
                >
                  +
                </button>
              </span>
              <input
                className="arr-note"
                value={step.note ?? ""}
                placeholder="cue, e.g. vamp while the pastor speaks"
                onChange={(e) => setSteps(updateStep(steps, i, { note: e.target.value }))}
                aria-label={`Cue for ${title}`}
              />
              <select
                className="arr-mark"
                value={markChoice(step.mark)}
                onChange={(e) =>
                  setSteps(updateStep(steps, i, { mark: markFromChoice(e.target.value as MarkChoice, step.mark) }))
                }
                aria-label={`Dynamics for ${title}`}
              >
                <option value="inherit">
                  {inherited ? `Section's own (${markName(inherited)})` : "Section's own"}
                </option>
                <option value="none">None</option>
                {PRESET_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {PRESETS[kind].name}
                  </option>
                ))}
                {step.mark?.kind === "custom" && (
                  <option value="custom">{markName({ section: "", occurrence: 1, ...step.mark })}</option>
                )}
              </select>
              <span className="arr-tools">
                <button className="mini" disabled={i === 0} title="Move up" onClick={() => setSteps(moveStep(steps, i, -1))}>
                  &#8593;
                </button>
                <button
                  className="mini"
                  disabled={i === steps.length - 1}
                  title="Move down"
                  onClick={() => setSteps(moveStep(steps, i, 1))}
                >
                  &#8595;
                </button>
                <button className="mini" title="Play this section again right after" onClick={() => setSteps(duplicateStep(steps, i))}>
                  Double
                </button>
                {remove}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="arr-foot">
        <select
          value={addIndex}
          onChange={(e) => setAdding(Number(e.target.value))}
          disabled={addable.length === 0}
          aria-label="Section to add"
        >
          {addable.map((s, k) => (
            <option key={`${s.section}#${s.occurrence}`} value={k}>
              {s.title}
            </option>
          ))}
        </select>
        <button className="mini" disabled={addable.length === 0} onClick={add}>
          Add
        </button>
        <button
          className="mini arr-reset"
          onClick={() => {
            if (window.confirm("Reset this version to the song as written? Its order, repeats, cues, and marks are cleared.")) {
              setSteps(defaultSteps(song));
            }
          }}
        >
          Reset to as written
        </button>
      </div>
    </section>
  );
}
