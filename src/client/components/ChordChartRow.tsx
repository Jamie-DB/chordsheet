import { displayChord, voicingFor, type ShapeResult } from "../../engine";
import type { Song } from "../../shared/types";
import { ChordDiagram } from "./ChordDiagram";

export interface DiagramSpec extends ShapeResult {
  label: string;
}

/** Unique displayed shapes in order of first appearance in the song. */
export function diagramSpecs(song: Song, shapedKeyName: string): DiagramSpec[] {
  const seen = new Set<string>();
  const out: DiagramSpec[] = [];
  const ordered = [...song.placements].sort((a, b) => a.line - b.line || a.col - b.col);
  for (const p of ordered) {
    const label = displayChord(p.chord, song.capo, shapedKeyName);
    if (seen.has(label)) continue;
    seen.add(label);
    const result = voicingFor(label);
    if (result) out.push({ label, ...result });
  }
  return out;
}

interface Props {
  song: Song;
  shapedKeyName: string;
}

export function ChordChartRow({ song, shapedKeyName }: Props) {
  const specs = diagramSpecs(song, shapedKeyName);
  if (specs.length === 0) return null;
  return (
    <div className="chord-chart-row">
      {specs.map((s) => (
        <ChordDiagram
          key={s.label}
          label={s.label}
          voicing={s.voicing}
          title={s.approximated ? `Showing ${s.playedAs} shape` : undefined}
        />
      ))}
    </div>
  );
}
