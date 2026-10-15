import type { DiagramStyle } from "../lib/printPrefs";

/** Full chord shapes or top-four-string triads; shared by the editor and the set view. */
export function DiagramStylePicker({ style, onChange }: { style: DiagramStyle; onChange(style: DiagramStyle): void }) {
  return (
    <label className="print-option" title="Which shapes the chord diagrams show, on screen and in print.">
      <select value={style} onChange={(e) => onChange(e.target.value as DiagramStyle)} aria-label="Chord diagram shapes">
        <option value="full">Full chords</option>
        <option value="triads">Top 4 string triads</option>
      </select>
    </label>
  );
}
