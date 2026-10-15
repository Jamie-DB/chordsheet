import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Song } from "../../shared/types";
import { ChordChartRow, diagramSpecs } from "./ChordChartRow";

const song = (chords: string[], capo = 0): Song => ({
  version: 1,
  id: "amazing-grace",
  title: "Amazing Grace",
  lyrics: ["Amazing grace, how sweet the sound"],
  placements: chords.map((chord, i) => ({ id: `p${i}`, line: 0, col: i * 4, chord })),
  keyOverride: "G",
  capo,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("diagramSpecs", () => {
  it("labels full shapes with the chord as shown", () => {
    expect(diagramSpecs(song(["G", "Em7", "Em"]), "G").map((s) => s.label)).toEqual(["G", "Em7", "Em"]);
  });

  it("labels triads by the triad played, one grid each", () => {
    expect(diagramSpecs(song(["G", "Em7", "Em", "G/B", "Cmaj7"]), "G", "triads").map((s) => s.label)).toEqual([
      "G",
      "Em",
      "C",
    ]);
  });

  it("voices triads for the shapes under a capo", () => {
    expect(diagramSpecs(song(["A"], 2), "G", "triads")[0].label).toBe("G");
  });
});

describe("ChordChartRow", () => {
  it("draws four strings for triads and six for full chords", () => {
    const lines = (style: "full" | "triads") =>
      (renderToStaticMarkup(createElement(ChordChartRow, { song: song(["G"]), shapedKeyName: "G", style })).match(/<line /g) ?? []).length;
    // Strings plus five fret lines.
    expect(lines("full")).toBe(6 + 5);
    expect(lines("triads")).toBe(4 + 5);
  });
});
