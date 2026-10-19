import { displayChord, triadHome, triadVoicingFor, voicingFor, type ShapeResult } from "../../engine";
import type { Song } from "../../shared/types";
import type { DiagramStyle } from "../lib/printPrefs";
import { capoByLine } from "../lib/sectionMarks";
import { ChordDiagram } from "./ChordDiagram";

export interface DiagramSpec extends ShapeResult {
  label: string;
}

/**
 * Unique displayed shapes in order of first appearance in the song. Triads
 * are labeled and deduplicated by the triad played, so C#m7 and C#m share
 * one C#m grid, and each sits nearest the triad before it.
 */
export function diagramSpecs(song: Song, shapedKeyName: string, style: DiagramStyle = "full"): DiagramSpec[] {
  const seen = new Set<string>();
  const out: DiagramSpec[] = [];
  let near = triadHome(shapedKeyName);
  const ordered = [...song.placements].sort((a, b) => a.line - b.line || a.col - b.col);
  const lineCapo = capoByLine(song.lyrics, song.sectionMarks ?? [], song.capo);
  for (const p of ordered) {
    const shown = displayChord(p.chord, lineCapo[p.line] ?? song.capo, shapedKeyName);
    if (style === "triads") {
      const triad = triadVoicingFor(shown, near);
      if (!triad || seen.has(triad.playedAs)) continue;
      seen.add(triad.playedAs);
      near = triad.center;
      out.push({ label: triad.playedAs, voicing: triad.voicing, playedAs: triad.playedAs, approximated: triad.approximated });
      continue;
    }
    if (seen.has(shown)) continue;
    seen.add(shown);
    const result = voicingFor(shown);
    if (result) out.push({ label: shown, ...result });
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
