import type { RiffPlacement } from "../lib/printPrefs";

/** Where riff tab prints; shared by the editor and the set view. */
export function RiffPlacementPicker({ placement, onChange }: { placement: RiffPlacement; onChange(placement: RiffPlacement): void }) {
  return (
    <label className="print-option" title="Where the riff tab boxes go on the printed sheet. With no riffs in print, the riff cues are left off too.">
      <select value={placement} onChange={(e) => onChange(e.target.value as RiffPlacement)} aria-label="Riffs in print">
        <option value="top">Riffs at the top</option>
        <option value="end">Riffs after the chart</option>
        <option value="off">No riffs in print</option>
      </select>
    </label>
  );
}
