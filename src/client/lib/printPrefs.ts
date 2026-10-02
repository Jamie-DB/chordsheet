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
