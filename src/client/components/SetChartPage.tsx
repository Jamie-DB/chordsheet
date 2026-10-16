import { capoBadge } from "../lib/sheetText";
import type { DiagramStyle } from "../lib/printPrefs";
import type { SetSheet } from "../lib/printSet";
import { ChordChartRow, diagramSpecs } from "./ChordChartRow";

/**
 * The first printed page of a set: every song's chord diagrams under its
 * title, so the songs themselves print without them. Each song keeps its
 * own row because the shapes depend on its capo.
 */
export function SetChartPage({ sheets, style = "full" }: { sheets: SetSheet[]; style?: DiagramStyle }) {
  const charted = sheets.filter((s) => diagramSpecs(s.song, s.shapedKeyName, style).length > 0);
  if (charted.length === 0) return null;
  return (
    <section className="print-chart-page">
      {charted.map((s, i) => (
        <div className="print-chart-song" key={i}>
          <div className="print-header">
            <h1>{s.versionName?.trim() ? `${s.song.title} (${s.versionName.trim()})` : s.song.title}</h1>
            {capoBadge(s.song.capo) && <span className="print-capo">{capoBadge(s.song.capo)}</span>}
          </div>
          <div className="print-diagrams">
            <ChordChartRow song={s.song} shapedKeyName={s.shapedKeyName} style={style} />
          </div>
        </div>
      ))}
    </section>
  );
}
