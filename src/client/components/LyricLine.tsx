import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import { xToCol } from "../lib/grid";
import { ChordChip } from "./ChordChip";
import { ChordEditPopover } from "./ChordEditPopover";

export interface ChipModel {
  id: string;
  col: number;
  label: string;
}

export interface EditingModel {
  line: number;
  col: number;
  /** null while adding a new chord. */
  id: string | null;
  initial: string;
}

interface Props {
  index: number;
  text: string;
  chips: ChipModel[];
  charWidth: number;
  pairHeight: number;
  lineCount: number;
  editing: EditingModel | null;
  maxColForLine(line: number): number;
  validate(text: string): boolean;
  onPlace(line: number, col: number): void;
  onCommitMove(id: string, line: number, col: number): void;
  onOpenEdit(id: string): void;
  onCommitEdit(text: string): void;
  onCancelEdit(): void;
}

export function LyricLine(props: Props) {
  const { index, text, chips, charWidth, pairHeight, lineCount, editing } = props;

  function colFromEvent(e: ReactMouseEvent | ReactPointerEvent): number {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return xToCol(e.clientX - rect.left, charWidth, props.maxColForLine(index));
  }

  const editingHere = editing !== null && editing.line === index;

  return (
    <div className="line-pair" data-line={index}>
      <div className="chord-lane" onClick={(e) => props.onPlace(index, colFromEvent(e))}>
        {chips.map((chip) =>
          editingHere && editing.id === chip.id ? null : (
            <ChordChip
              key={chip.id}
              id={chip.id}
              line={index}
              col={chip.col}
              label={chip.label}
              charWidth={charWidth}
              pairHeight={pairHeight}
              lineCount={lineCount}
              maxColForLine={props.maxColForLine}
              onCommitMove={props.onCommitMove}
              onOpenEdit={props.onOpenEdit}
            />
          ),
        )}
        {editingHere && (
          <ChordEditPopover
            col={editing.col}
            initial={editing.initial}
            isNew={editing.id === null}
            validate={props.validate}
            onCommit={props.onCommitEdit}
            onCancel={props.onCancelEdit}
          />
        )}
      </div>
      <pre className="lyric-row" onClick={(e) => props.onPlace(index, colFromEvent(e))}>
        {text || " "}
      </pre>
    </div>
  );
}
