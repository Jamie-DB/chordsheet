import { useState } from "react";

const KEY = "chordsheet.printDiagrams.v1";

/**
 * Whether printed sheets carry the chord diagram row. One choice for the
 * song's Print button and the set's, kept in localStorage; on by default.
 */
export function usePrintDiagrams(): [boolean, (show: boolean) => void] {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "off";
    } catch {
      return true;
    }
  });
  return [
    show,
    (next) => {
      setShow(next);
      try {
        localStorage.setItem(KEY, next ? "on" : "off");
      } catch (err) {
        console.warn("chordsheet: could not save print preference", err);
      }
    },
  ];
}

const STYLE_KEY = "chordsheet.diagramStyle.v1";

/** Full six-string chord shapes, or triads on the top four strings. */
export type DiagramStyle = "full" | "triads";

/**
 * Which shapes the chord diagrams show, on screen and in print. One choice
 * for every song and set, kept in localStorage; full chords by default.
 */
export function useDiagramStyle(): [DiagramStyle, (style: DiagramStyle) => void] {
  const [style, setStyle] = useState<DiagramStyle>(() => {
    try {
      return localStorage.getItem(STYLE_KEY) === "triads" ? "triads" : "full";
    } catch {
      return "full";
    }
  });
  return [
    style,
    (next) => {
      setStyle(next);
      try {
        localStorage.setItem(STYLE_KEY, next);
      } catch (err) {
        console.warn("chordsheet: could not save diagram style", err);
      }
    },
  ];
}
