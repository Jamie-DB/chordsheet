import { useEffect, useRef, useState } from "react";
import { voicingFor } from "../../engine";
import { dragCol, dragLine } from "../lib/grid";
import { ChordDiagram } from "./ChordDiagram";
import { DiamondOutline } from "./DiamondOutline";

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
  /** Hover diagrams only: no drag, no click to edit. */
  readOnly?: boolean;
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

  /**
   * The line under the pointer, found by hit-testing the rendered rows.
   * Rows differ in height (collapsed labels take none, tacet rows are
   * smaller), so counting uniform row heights lands off by one after the
   * first such row. dy is the pixel distance between the two rows.
   */
  function lineUnderPointer(x: number, y: number): { line: number; dy: number } | null {
    const own = el.current?.closest("[data-line]");
    for (const node of document.elementsFromPoint(x, y)) {
      if (el.current?.contains(node)) continue;
      const pair = node.closest("[data-line]");
      if (!(pair instanceof HTMLElement)) continue;
      const hit = Number(pair.dataset.line);
      if (!Number.isInteger(hit)) continue;
      const dy =
        own instanceof HTMLElement
          ? pair.getBoundingClientRect().top - own.getBoundingClientRect().top
          : (hit - line) * pairHeight;
      return { line: hit, dy };
    }
    return null;
  }

  function targetFor(x: number, y: number, dxPx: number, dyPx: number) {
    // Uniform row math is only the fallback, for a pointer outside every row.
    const hit = lineUnderPointer(x, y);
    const newLine = hit?.line ?? dragLine(line, dyPx, pairHeight, lineCount);
    const newCol = dragCol(col, dxPx, charWidth, maxColForLine(newLine));
    const dy = hit?.dy ?? (newLine - line) * pairHeight;
    return { newLine, newCol, dy };
  }

  const shape = card ? voicingFor(label) : null;

  return (
    <span
      ref={el}
      className={`chord-chip${hold ? " hold-diamond" : ""}${offset ? " dragging" : ""}${props.readOnly ? " read-only" : ""}`}
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
        if (props.readOnly) return;
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
        const { newCol, dy } = targetFor(e.clientX, e.clientY, dxPx, dyPx);
        setOffset({ dx: (newCol - col) * charWidth, dy });
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
        const { newLine, newCol } = targetFor(e.clientX, e.clientY, dxPx, dyPx);
        if (newLine !== line || newCol !== col) props.onCommitMove(id, newLine, newCol);
      }}
      onPointerCancel={() => {
        start.current = null;
        setOffset(null);
        hideCard();
      }}
    >
      {label}
      {hold && <DiamondOutline />}
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
