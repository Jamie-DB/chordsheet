import type { Setlist, Song } from "../../shared/types";
import type { DiagramStyle } from "../lib/printPrefs";
import { setSheets } from "../lib/printSet";
import { printFooterCss } from "../lib/sheetText";
import { PrintSheet } from "./PrintSheet";
import { SetChartPage } from "./SetChartPage";

interface Props {
  set: Setlist;
  songs: Song[];
  /** A first page of every song's chord diagrams; the songs then print without them. */
  showDiagrams: boolean;
  diagramStyle?: DiagramStyle;
}

/** Everything a set prints in one job: the optional chord page, then each song in order. */
export function SetPrint({ set, songs, showDiagrams, diagramStyle = "full" }: Props) {
  const sheets = setSheets(set, songs);
  return (
    <div className="set-print">
      <style>{printFooterCss(set.name)}</style>
      {showDiagrams && <SetChartPage sheets={sheets} style={diagramStyle} />}
      {sheets.map((sheet, i) => (
        <PrintSheet key={i} {...sheet} showDiagrams={false} inSet />
      ))}
    </div>
  );
}
