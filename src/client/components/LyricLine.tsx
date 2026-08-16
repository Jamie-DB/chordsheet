import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import { xToCol } from "../lib/grid";
import { isSectionLabel } from "../lib/lineOps";
import { ChordChip } from "./ChordChip";
import { ChordEditPopover } from "./ChordEditPopover";

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
}

export function LyricLine(props: Props) {
  const { index, text, chips, charWidth, pairHeight, lineCount, editing } = props;
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

  const editingHere = editing !== null && editing.line === index;

  return (
    <div className="line-pair" data-line={index}>
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
      <div className="chord-lane" onClick={(e) => props.onPlace(index, colFromEvent(e))}>
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
            />
          ),
        )}
        {props.proposals.map((p) => (
          <span
            key={p.id}
            className="chord-chip proposal"
            style={{ left: `${p.col}ch` }}
            title="Proposed by import; click to accept"
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
      </div>
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
      ) : (
        <pre
          className={`lyric-row${isSectionLabel(text) ? " section-label" : ""}`}
          title="Click to place a chord; double-click to edit the words"
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
