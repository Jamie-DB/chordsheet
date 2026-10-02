import { detectKey, keyPrefersFlat, semitonesBetweenKeys, transposeSymbol } from "../../engine";
import type { Arrangement, Chart, Song } from "../../shared/types";
import type { Block } from "./arrangement";
import { arrangeableSections, sectionSummaries, toBlocks } from "./arrangement";
import { slugify } from "./storage";
import { findArrangement } from "./versions";

/** The song as written has no name of its own; the pickers call it this. */
export const WRITTEN_NAME = "As written";

/** The fields a chart carries, with explicit undefined so a copy never inherits a stale value. */
function pickChart(from: Chart): Chart {
  return {
    lyrics: from.lyrics,
    placements: from.placements,
    keyOverride: from.keyOverride,
    capo: from.capo,
    bpm: from.bpm,
    notes: from.notes,
    sectionMarks: from.sectionMarks,
    outSections: from.outSections,
  };
}

/**
 * The song as the editor, print, and every chart tool see it for one chart:
 * the song's identity with that chart's own content. A null or unknown id is
 * the song as written.
 */
export function chartOf(song: Song, id: string | null | undefined): Song {
  const version = findArrangement(song, id);
  if (!version) return song;
  return { ...song, ...pickChart(version), arrangements: undefined };
}

/** Write an edited chart back to where it came from, leaving every other chart alone. */
export function withChart(song: Song, id: string | null | undefined, edited: Song): Song {
  const version = findArrangement(song, id);
  if (!version) return { ...song, ...pickChart(edited) };
  const stamped: Arrangement = { ...version, ...pickChart(edited), updatedAt: new Date().toISOString() };
  return { ...song, arrangements: song.arrangements?.map((a) => (a.id === version.id ? stamped : a)) };
}

/** Every chart of the song, As written first, as the song each one makes. */
export function allCharts(song: Song): Array<{ id: string | null; name: string; chart: Song }> {
  return [
    { id: null, name: WRITTEN_NAME, chart: chartOf(song, null) },
    ...(song.arrangements ?? []).map((a) => ({ id: a.id, name: a.name, chart: chartOf(song, a.id) })),
  ];
}

/** A new version holding a full copy of the chart it is made from (null: as written). */
export function createArrangement(song: Song, name: string, fromId: string | null): Arrangement {
  const now = new Date().toISOString();
  const taken = new Set((song.arrangements ?? []).map((a) => a.id));
  const trimmed = name.trim() || "Version";
  return {
    id: slugify(trimmed, taken),
    name: trimmed,
    ...pickChart(chartOf(song, fromId)),
    createdAt: now,
    updatedAt: now,
  };
}

/** Insert or replace by id; stamps updatedAt. */
export function withArrangement(song: Song, arrangement: Arrangement): Song {
  const stamped = { ...arrangement, updatedAt: new Date().toISOString() };
  const list = song.arrangements ?? [];
  const exists = list.some((a) => a.id === arrangement.id);
  return {
    ...song,
    arrangements: exists
      ? list.map((a) => (a.id === arrangement.id ? stamped : a))
      : [...list, stamped],
  };
}

export function withoutArrangement(song: Song, id: string): Song {
  const rest = (song.arrangements ?? []).filter((a) => a.id !== id);
  return { ...song, arrangements: rest.length > 0 ? rest : undefined };
}

/** The key a chart's header shows: its own pick, else the key its chords suggest. */
export function soundingKeyOf(chart: Song): string | null {
  return chart.keyOverride ?? detectKey(chart.placements.map((p) => p.chord))?.name ?? null;
}

/** A section's chords moved from one chart's key into another's; unchanged when either key is unknown. */
function intoKey(block: Block, from: string | null, to: string | null): Block {
  if (!from || !to) return block;
  const shift = semitonesBetweenKeys(from, to);
  if (!shift) return block;
  const prefer = keyPrefersFlat(to) ? "flat" : "sharp";
  return { ...block, chords: block.chords.map((c) => ({ ...c, chord: transposeSymbol(c.chord, shift, prefer) })) };
}

/** A section that can be copied into a chart, from any chart of the song. */
export interface SectionChoice {
  /** The chart plus the section's label and occurrence, so a pick survives sections being added or moved. */
  key: string;
  /** "Version name: Chorus". */
  label: string;
  /** Already in the key of the chart being edited. */
  block: Block;
}

/**
 * Every section with content across the song's charts, for "add a section".
 * The chart being edited contributes its live state, not the stored one.
 * Sections from a chart in another key come transposed into this one's.
 */
export function sectionChoices(stored: Song, chart: Song, chartId: string | null): SectionChoice[] {
  const targetKey = soundingKeyOf(chart);
  return allCharts(stored).flatMap(({ id, name, chart: source }) => {
    const live = id === chartId ? chart : source;
    const sourceKey = soundingKeyOf(live);
    const anchors = arrangeableSections(live);
    const blocks = toBlocks(live);
    return sectionSummaries(live).flatMap((s, k) =>
      s.hasContent
        ? [
            {
              key: `${id ?? ""}#${anchors[k].section}#${anchors[k].occurrence}`,
              label: `${name}: ${s.title}`,
              block: intoKey(blocks[k], sourceKey, targetKey),
            },
          ]
        : [],
    );
  });
}
