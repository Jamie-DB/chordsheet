import { useEffect, useRef, useState } from "react";
import type { ReactNode, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import type { MarkKind, SectionMark } from "../../shared/types";
import { xToCol } from "../lib/grid";
import type { SectionType } from "../lib/sectionMarks";
import { ChordChip } from "./ChordChip";
import { ChordEditPopover } from "./ChordEditPopover";
import { SectionMarkPicker } from "./SectionMarkPicker";

export interface SectionUi {
  /** Bracket-free section title, e.g. "Verse 1". */
  title: string;
  /** Displayed term when marked (preset name or note override), else null. */
  name: string | null;
  /** Section type; the tag and side bar take its color. */
  type: SectionType;
  /** Opens a run of sections the player sits out; the tag shows an OUT stamp. */
  outStart?: boolean;
  pickerOpen: boolean;
  current: SectionMark | null;
  onOpen(): void;
  onPick(kind: MarkKind, text?: string): void;
  onClear(): void;
  onClose(): void;
}

/** A version's section tag while its order is being edited. */
export interface StepUi {
  selected: boolean;
  /** Diamonds on every chord of the step; the tag shows a diamond. */
  hold: boolean;
  onToggle(): void;
  /** The step's controls, shown by the tag when it is selected. */
  controls?: ReactNode;
}

export interface ChipModel {
  id: string;
  col: number;
  label: string;
  hold: boolean;
}

export interface EditingModel {
  line: number;
  col: number;
  /** null while adding a new chord. */
  id: string | null;
  initial: string;
  initialHold: boolean;
}

interface Props {
  index: number;
  text: string;
  chips: ChipModel[];
  /** Import-review proposals; amber, click to accept, not draggable. */
  proposals: ChipModel[];
  charWidth: number;
  pairHeight: number;
  lineCount: number;
  editing: EditingModel | null;
  /** When true, this line opens its text editor immediately (fresh insert). */
  autoEdit: boolean;
  onAutoEditConsumed(): void;
  maxColForLine(line: number): number;
  validate(text: string): boolean;
  onPlace(line: number, col: number): void;
  onCommitMove(id: string, line: number, col: number): void;
  onOpenEdit(id: string): void;
  onCommitEdit(text: string, hold: boolean): void;
  onCancelEdit(): void;
  onAcceptProposal(id: string): void;
  onCommitLine(index: number, text: string): void;
  onInsertLine(at: number): void;
  onDeleteLine(index: number): void;
  /** Present only on section label lines. */
  sectionUi?: SectionUi;
  /** Tint/bar class when this line sits inside a marked section. */
  sectionClass?: string;
  /** Present on a version's label lines while its order is being edited. */
  stepUi?: StepUi;
  /** The line belongs to the version step whose controls are open. */
  stepSelected?: boolean;
  /**
   * A version's sheet: chords show with hover diagrams, but nothing places,
   * moves, or edits chords, words, lines, or marks. The edit callbacks are
   * never called.
   */
  readOnly?: boolean;
}

export function LyricLine(props: Props) {
  const { index, text, chips, charWidth, pairHeight, lineCount, editing, readOnly = false } = props;
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (props.autoEdit && draft === null) {
      setDraft(text);
      props.onAutoEditConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.autoEdit]);

  useEffect(() => {
    if (draft !== null) inputRef.current?.focus();
  }, [draft]);

  function colFromEvent(e: ReactMouseEvent | ReactPointerEvent): number {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return xToCol(e.clientX - rect.left, charWidth, props.maxColForLine(index));
  }

  function commitDraft() {
    if (draft === null) return;
    props.onCommitLine(index, draft);
    setDraft(null);
  }

  const editingHere = !readOnly && editing !== null && editing.line === index;

  const { sectionUi } = props;
  // Section label rows leave the vertical flow (their tag lives in the left
  // sidebar) unless being edited or carrying chords above them.
  const collapsed = sectionUi !== undefined && draft === null && chips.length === 0 && !editingHere;

  return (
    <div
      className={`line-pair${props.sectionClass ? ` ${props.sectionClass}` : ""}${collapsed ? " label-collapsed" : ""}${readOnly ? " read-only" : ""}${props.stepSelected ? " step-selected" : ""}`}
      data-line={index}
    >
      {!readOnly && (
        <span className="line-tools">
          <button className="mini" title="Insert line above" onClick={() => props.onInsertLine(index)}>
            +&#8593;
          </button>
          <button className="mini" title="Insert line below" onClick={() => props.onInsertLine(index + 1)}>
            +&#8595;
          </button>
          <button className="mini danger" title="Delete line" onClick={() => props.onDeleteLine(index)}>
            &#215;
          </button>
        </span>
      )}
      <div className="chord-lane" onClick={readOnly ? undefined : (e) => props.onPlace(index, colFromEvent(e))}>
        {chips.map((chip) =>
          editingHere && editing.id === chip.id ? null : (
            <ChordChip
              key={chip.id}
              id={chip.id}
              line={index}
              col={chip.col}
              label={chip.label}
              hold={chip.hold}
              charWidth={charWidth}
              pairHeight={pairHeight}
              lineCount={lineCount}
              maxColForLine={props.maxColForLine}
              onCommitMove={props.onCommitMove}
              onOpenEdit={props.onOpenEdit}
              readOnly={readOnly}
            />
          ),
        )}
        {props.proposals.map((p) => (
          <span
            key={p.id}
            className="chord-chip proposal"
            style={{ left: `${p.col}ch` }}
            title="Proposed by import. Click to accept"
            onClick={(e) => {
              e.stopPropagation();
              props.onAcceptProposal(p.id);
            }}
          >
            {p.label}
          </span>
        ))}
        {editingHere && (
          <ChordEditPopover
            col={editing.col}
            initial={editing.initial}
            initialHold={editing.initialHold}
            isNew={editing.id === null}
            validate={props.validate}
            onCommit={props.onCommitEdit}
            onCancel={props.onCancelEdit}
          />
        )}
        {!readOnly && sectionUi?.pickerOpen && (
          <SectionMarkPicker
            col={2}
            current={sectionUi.current}
            onPick={sectionUi.onPick}
            onClear={sectionUi.onClear}
            onClose={sectionUi.onClose}
          />
        )}
      </div>
      {/* Outside the lane: an out section fades its lane, and the controls must not fade with it. */}
      {props.stepUi?.controls && <div className="step-controls-anchor">{props.stepUi.controls}</div>}
      {draft !== null ? (
        <input
          ref={inputRef}
          className="line-edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitDraft();
            if (e.key === "Escape") setDraft(null);
          }}
          aria-label={`Edit line ${index + 1}`}
        />
      ) : sectionUi && readOnly && props.stepUi ? (
        <div className="label-side">
          <button
            className={`section-tag step-tag pill-${sectionUi.type}${props.stepUi.selected ? " selected" : ""}`}
            aria-pressed={props.stepUi.selected}
            onClick={(e) => {
              e.stopPropagation();
              props.stepUi?.onToggle();
            }}
            title="Click for this section's controls in this version"
          >
            {sectionUi.title}
            {props.stepUi.hold && <span className="tag-hold">&#9671;</span>}
            {sectionUi.outStart && <span className="tag-out">OUT</span>}
            {sectionUi.name && <span className="tag-note">{sectionUi.name}</span>}
          </button>
        </div>
      ) : sectionUi && readOnly ? (
        <div className="label-side">
          <span className={`section-tag read-only pill-${sectionUi.type}`}>
            {sectionUi.title}
            {sectionUi.outStart && <span className="tag-out">OUT</span>}
            {sectionUi.name && <span className="tag-note">{sectionUi.name}</span>}
          </span>
        </div>
      ) : sectionUi ? (
        <div className="label-side">
          <button
            className={`section-tag pill-${sectionUi.type}`}
            // The dynamics mark picker is off pending removal (#75); the click still must not place a chord.
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              props.onCancelEdit();
              setDraft(text);
            }}
            title="Double-click to rename the section"
          >
            {sectionUi.title}
            {sectionUi.outStart && <span className="tag-out">OUT</span>}
            {sectionUi.name && <span className="tag-note">{sectionUi.name}</span>}
          </button>
        </div>
      ) : readOnly ? (
        <pre className="lyric-row">{text || " "}</pre>
      ) : (
        <pre
          className="lyric-row"
          title="Click to place a chord, double-click to edit the words"
          onClick={(e) => props.onPlace(index, colFromEvent(e))}
          onDoubleClick={() => {
            props.onCancelEdit();
            setDraft(text);
          }}
        >
          {text || " "}
        </pre>
      )}
    </div>
  );
}
