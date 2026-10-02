import { describe, expect, it } from "vitest";
import type { Song } from "../../shared/types";
import { removeSection, toggleOut } from "./arrangement";
import {
  WRITTEN_NAME,
  allCharts,
  chartOf,
  createArrangement,
  sectionChoices,
  withArrangement,
  withChart,
  withoutArrangement,
} from "./charts";
import { transposeSong } from "./songOps";

const song: Song = {
  version: 1,
  id: "amazing-grace",
  title: "Amazing Grace",
  artist: "John Newton",
  lyrics: ["[Verse 1]", "Amazing grace", "", "[Chorus]", "How sweet the sound"],
  placements: [
    { id: "a", line: 1, col: 0, chord: "G" },
    { id: "b", line: 4, col: 0, chord: "C" },
  ],
  keyOverride: "G",
  capo: 2,
  bpm: 72,
  notes: "Fingerpick",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const withShort = (): Song => {
  const version = createArrangement(song, "Short", null);
  return withArrangement(song, { ...version, lyrics: ["[Chorus]", "How sweet the sound"], placements: [{ id: "b", line: 1, col: 0, chord: "C" }] });
};

describe("createArrangement", () => {
  it("starts as a full copy of the song as written, key, capo, tempo, and notes included", () => {
    const v = createArrangement(song, "Sep 24 version", null);
    expect(v).toMatchObject({
      id: "sep-24-version",
      name: "Sep 24 version",
      lyrics: song.lyrics,
      placements: song.placements,
      keyOverride: "G",
      capo: 2,
      bpm: 72,
      notes: "Fingerpick",
    });
  });

  it("copies from another version when asked, not from the song as written", () => {
    const base = withShort();
    const copy = createArrangement(base, "Short copy", "short");
    expect(copy.lyrics).toEqual(["[Chorus]", "How sweet the sound"]);
    expect(copy.id).toBe("short-copy");
  });

  it("dedupes ids and names a blank name", () => {
    const base = withShort();
    expect(createArrangement(base, "Short", null).id).not.toBe("short");
    expect(createArrangement(base, "  ", null).name).toBe("Version");
  });
});

describe("chartOf and withChart", () => {
  it("is the song itself for the song as written and for an unknown id", () => {
    expect(chartOf(song, null)).toBe(song);
    expect(chartOf(song, "nope")).toBe(song);
  });

  it("gives a version's own content under the song's title and artist, with no versions of its own", () => {
    const chart = chartOf(withShort(), "short");
    expect(chart.title).toBe("Amazing Grace");
    expect(chart.artist).toBe("John Newton");
    expect(chart.lyrics).toEqual(["[Chorus]", "How sweet the sound"]);
    expect(chart.arrangements).toBeUndefined();
  });

  it("never lets a missing field fall through to the song as written", () => {
    const base = withShort();
    const bare = withArrangement(base, { ...base.arrangements![0], bpm: undefined, notes: undefined });
    const chart = chartOf(bare, "short");
    expect(chart.bpm).toBeUndefined();
    expect(chart.notes).toBeUndefined();
  });

  it("writes an edit to a version without touching the song as written or other versions", () => {
    const base = withArrangement(withShort(), createArrangement(withShort(), "Other", null));
    const edited = withChart(base, "short", { ...chartOf(base, "short"), capo: 5, bpm: 100 });
    expect(edited.arrangements?.find((a) => a.id === "short")).toMatchObject({ capo: 5, bpm: 100 });
    expect(edited.arrangements?.find((a) => a.id === "other")).toEqual(base.arrangements?.find((a) => a.id === "other"));
    expect(edited.capo).toBe(2);
    expect(edited.lyrics).toEqual(song.lyrics);
  });

  it("writes an edit to the song as written without touching any version", () => {
    const base = withShort();
    const edited = withChart(base, null, { ...chartOf(base, null), capo: 0, lyrics: ["[Verse 1]", "Amazing"] });
    expect(edited.capo).toBe(0);
    expect(edited.lyrics).toEqual(["[Verse 1]", "Amazing"]);
    expect(edited.arrangements).toBe(base.arrangements);
    expect(edited.title).toBe("Amazing Grace");
  });

  it("transposing one version leaves every other chart in its key", () => {
    const base = withShort();
    const up = withChart(base, "short", transposeSong(chartOf(base, "short"), "G", 2));
    expect(up.arrangements?.[0].placements[0].chord).toBe("D");
    expect(up.arrangements?.[0].keyOverride).toBe("A");
    expect(up.placements.map((p) => p.chord)).toEqual(["G", "C"]);
    expect(up.keyOverride).toBe("G");
  });

  it("section operations on one version leave the others alone", () => {
    const base = withShort();
    const edited = withChart(base, "short", toggleOut(chartOf(base, "short"), 0));
    expect(edited.arrangements?.[0].outSections).toEqual([{ section: "[Chorus]", occurrence: 1 }]);
    expect(edited.outSections).toBeUndefined();
    const trimmed = withChart(base, null, removeSection(chartOf(base, null), 0));
    expect(trimmed.lyrics).toEqual(["[Chorus]", "How sweet the sound"]);
    expect(trimmed.arrangements?.[0].lyrics).toEqual(base.arrangements?.[0].lyrics);
  });
});

describe("version list", () => {
  it("withArrangement inserts a new id and replaces an existing one, stamping updatedAt", () => {
    const base = withShort();
    const old = { ...base.arrangements![0], updatedAt: "2026-01-01T00:00:00.000Z" };
    const renamed = withArrangement({ ...base, arrangements: [old] }, { ...old, name: "Shorter" });
    expect(renamed.arrangements).toHaveLength(1);
    expect(renamed.arrangements?.[0].name).toBe("Shorter");
    expect(renamed.arrangements?.[0].updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
  });

  it("withoutArrangement removes by id and leaves arrangements undefined when empty", () => {
    expect(withoutArrangement(withShort(), "short").arrangements).toBeUndefined();
  });

  it("allCharts lists As written first, then each version", () => {
    expect(allCharts(withShort()).map((c) => [c.id, c.name])).toEqual([[null, WRITTEN_NAME], ["short", "Short"]]);
  });

  it("sectionChoices offers every chart's sections, using the live state of the one being edited", () => {
    const base = withShort();
    const live = { ...chartOf(base, null), lyrics: ["[Bridge]", "Was blind"], placements: [] };
    const labels = sectionChoices(base, live, null).map((c) => c.label);
    expect(labels).toEqual(["As written: Bridge", "Short: Chorus"]);
  });
});
