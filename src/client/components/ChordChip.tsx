import { useRef, useState } from "react";
import { dragCol, dragLine } from "../lib/grid";

const DRAG_THRESHOLD_PX = 4;

interface Props {
  id: string;
  line: number;
  col: number;
  /** Display text: the shape the hands play under the current capo. */
  label: string;
  charWidth: number;
  pairHeight: number;
  lineCount: number;
  maxColForLine(line: number): number;
  onCommitMove(id: string, line: number, col: number): void;
  onOpenEdit(id: string): void;
}

export function ChordChip(props: Props) {
  const { id, line, col, label, charWidth, pairHeight, lineCount, maxColForLine } = props;
  const start = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState<{ dx: number; dy: number } | null>(null);

  function targetFor(dxPx: number, dyPx: number) {
    const newLine = dragLine(line, dyPx, pairHeight, lineCount);
    const newCol = dragCol(col, dxPx, charWidth, maxColForLine(newLine));
    return { newLine, newCol };
  }

  return (
    <span
      className={`chord-chip${offset ? " dragging" : ""}`}
      style={{
        left: `${col}ch`,
        transform: offset ? `translate(${offset.dx}px, ${offset.dy}px)` : undefined,
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const dxPx = e.clientX - start.current.x;
        const dyPx = e.clientY - start.current.y;
        if (!offset && Math.hypot(dxPx, dyPx) < DRAG_THRESHOLD_PX) return;
        const { newLine, newCol } = targetFor(dxPx, dyPx);
        setOffset({ dx: (newCol - col) * charWidth, dy: (newLine - line) * pairHeight });
      }}
      onPointerUp={(e) => {
        if (!start.current) return;
        const dxPx = e.clientX - start.current.x;
        const dyPx = e.clientY - start.current.y;
        const wasDrag = offset !== null;
        start.current = null;
        setOffset(null);
        if (!wasDrag && Math.hypot(dxPx, dyPx) < DRAG_THRESHOLD_PX) {
          props.onOpenEdit(id);
          return;
        }
        const { newLine, newCol } = targetFor(dxPx, dyPx);
        if (newLine !== line || newCol !== col) props.onCommitMove(id, newLine, newCol);
      }}
      onPointerCancel={() => {
        start.current = null;
        setOffset(null);
      }}
    >
      {label}
    </span>
  );
}
