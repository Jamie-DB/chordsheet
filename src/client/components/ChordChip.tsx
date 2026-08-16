import { useEffect, useRef, useState } from "react";
import { voicingFor } from "../../engine";
import { dragCol, dragLine } from "../lib/grid";
import { ChordDiagram } from "./ChordDiagram";

const DRAG_THRESHOLD_PX = 4;
const HOVER_DELAY_MS = 330;

interface Props {
  id: string;
  line: number;
  col: number;
  /** Display text: the shape the hands play under the current capo. */
  label: string;
  /** Full-measure hold; drawn with a diamond enclosure. */
  hold: boolean;
  charWidth: number;
  pairHeight: number;
  lineCount: number;
  maxColForLine(line: number): number;
  onCommitMove(id: string, line: number, col: number): void;
  onOpenEdit(id: string): void;
}

interface HoverCard {
  x: number;
  y: number;
  below: boolean;
}

export function ChordChip(props: Props) {
  const { id, line, col, label, hold, charWidth, pairHeight, lineCount, maxColForLine } = props;
  const start = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState<{ dx: number; dy: number } | null>(null);
  const el = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const [card, setCard] = useState<HoverCard | null>(null);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  function hideCard() {
    window.clearTimeout(hoverTimer.current);
    setCard(null);
  }

  function targetFor(dxPx: number, dyPx: number) {
    const newLine = dragLine(line, dyPx, pairHeight, lineCount);
    const newCol = dragCol(col, dxPx, charWidth, maxColForLine(newLine));
    return { newLine, newCol };
  }

  const shape = card ? voicingFor(label) : null;

  return (
    <span
      ref={el}
      className={`chord-chip${hold ? " hold-diamond" : ""}${offset ? " dragging" : ""}`}
      style={{
        left: `${col}ch`,
        transform: offset ? `translate(${offset.dx}px, ${offset.dy}px)` : undefined,
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerEnter={() => {
        if (start.current) return;
        window.clearTimeout(hoverTimer.current);
        hoverTimer.current = window.setTimeout(() => {
          const rect = el.current?.getBoundingClientRect();
          if (!rect) return;
          const below = rect.top < 130;
          setCard({ x: rect.left, y: below ? rect.bottom + 6 : rect.top - 6, below });
        }, HOVER_DELAY_MS);
      }}
      onPointerLeave={hideCard}
      onPointerDown={(e) => {
        hideCard();
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
        hideCard();
      }}
    >
      {label}
      {card && shape && (
        <span
          className="chord-hover-card"
          style={{
            left: card.x,
            top: card.y,
            transform: card.below ? undefined : "translateY(-100%)",
          }}
        >
          <ChordDiagram label={label} voicing={shape.voicing} />
          {shape.approximated && <span className="hover-note">shows {shape.playedAs}</span>}
        </span>
      )}
    </span>
  );
}
