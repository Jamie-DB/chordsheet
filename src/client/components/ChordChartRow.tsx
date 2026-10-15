import { displayChord, triadHome, triadVoicingFor, voicingFor, type ShapeResult } from "../../engine";
import type { Song } from "../../shared/types";
import type { DiagramStyle } from "../lib/printPrefs";
import { ChordDiagram } from "./ChordDiagram";

export interface DiagramSpec extends ShapeResult {
  label: string;
}

/**
 * Unique displayed shapes in order of first appearance in the song. Triads
 * are labeled and deduplicated by the triad played, so C#m7 and C#m share
 * one C#m grid.
 */
export function diagramSpecs(song: Song, shapedKeyName: string, style: DiagramStyle = "full"): DiagramSpec[] {
  const seen = new Set<string>();
  const out: DiagramSpec[] = [];
  const home = triadHome(shapedKeyName);
  const ordered = [...song.placements].sort((a, b) => a.line - b.line || a.col - b.col);
  for (const p of ordered) {
    const shown = displayChord(p.chord, song.capo, shapedKeyName);
    const result = style === "triads" ? triadVoicingFor(shown, home) : voicingFor(shown);
    const label = style === "triads" && result ? result.playedAs : shown;
    if (seen.has(label)) continue;
    seen.add(label);
    if (result) out.push({ label, ...result });
  }
  return out;
}

interface Props {
  song: Song;
  shapedKeyName: string;
  style?: DiagramStyle;
}

export function ChordChartRow({ song, shapedKeyName, style = "full" }: Props) {
  const specs = diagramSpecs(song, shapedKeyName, style);
  if (specs.length === 0) return null;
  return (
    <div className="chord-chart-row">
      {specs.map((s) => (
        <ChordDiagram
          key={s.label}
          label={s.label}
          voicing={s.voicing}
          strings={style === "triads" ? 4 : 6}
          title={s.approximated && style === "full" ? `Showing ${s.playedAs} shape` : undefined}
        />
      ))}
    </div>
  );
}
