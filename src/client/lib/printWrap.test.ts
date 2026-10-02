import { describe, expect, it } from "vitest";
import type { ChordPlacement } from "../../shared/types";
import { wrapLine } from "./printWrap";

const at = (col: number, chord: string): ChordPlacement => ({ id: `${chord}${col}`, line: 0, col, chord });
const plain = (chord: string) => chord;
const LINE = "Amazing grace, how sweet the sound that saved a wretch like me";

describe("wrapLine", () => {
  it("returns a line that fits as one row, unchanged", () => {
    expect(wrapLine("Amazing grace", [at(0, "G"), at(8, "C")], plain, 38)).toEqual([
      { lyric: "Amazing grace", placements: [at(0, "G"), at(8, "C")] },
    ]);
  });

  it("breaks after a space and indents the continuation", () => {
    const rows = wrapLine(LINE, [], plain, 38);
    expect(rows.map((r) => r.lyric)).toEqual([
      "Amazing grace, how sweet the sound",
      "  that saved a wretch like me",
    ]);
  });

  it("moves each chord to its column in the row its words land in", () => {
    const rows = wrapLine(LINE, [at(0, "G"), at(35, "C"), at(48, "D")], plain, 38);
    expect(rows[0].placements.map((p) => [p.chord, p.col])).toEqual([["G", 0]]);
    // "that" starts at 35; the continuation is indented 2.
    expect(rows[1].placements.map((p) => [p.chord, p.col])).toEqual([["C", 2], ["D", 15]]);
    expect(rows[1].lyric.slice(15, 15 + 4)).toBe("wret");
  });

  it("never breaks through a chord symbol", () => {
    // "sound" ends at col 34 and a long chord sits across the space after it.
    const rows = wrapLine(LINE, [at(33, "Cmaj7sus4")], (c) => c, 38);
    for (const row of rows) {
      const chord = row.placements.find((p) => p.chord === "Cmaj7sus4");
      if (chord) expect(chord.col + "Cmaj7sus4".length).toBeLessThanOrEqual(38);
    }
  });

  it("keeps collisions pushed right the way the chord row lays them out", () => {
    const rows = wrapLine("Amazing grace", [at(0, "Gmaj7"), at(2, "C")], plain, 38);
    expect(rows[0].placements.map((p) => [p.chord, p.col])).toEqual([["Gmaj7", 0], ["C", 6]]);
  });

  it("wraps a chord run past the end of the lyric", () => {
    const chords = [at(0, "G"), at(10, "C"), at(20, "D"), at(30, "Em"), at(40, "Am"), at(50, "G")];
    const rows = wrapLine("Intro", chords, plain, 38);
    expect(rows.length).toBe(2);
    expect(rows.flatMap((r) => r.placements.map((p) => p.chord))).toEqual(["G", "C", "D", "Em", "Am", "G"]);
    expect(rows[1].lyric).toBe("");
  });

  it("hard-breaks a word longer than the row", () => {
    const rows = wrapLine("A".repeat(50), [], plain, 38);
    expect(rows.map((r) => r.lyric.length)).toEqual([38, 14]);
  });

  it("wraps a line into as many rows as it needs", () => {
    const rows = wrapLine(Array.from({ length: 30 }, () => "word").join(" "), [], plain, 38);
    expect(rows.length).toBeGreaterThan(3);
    for (const row of rows) expect(row.lyric.length).toBeLessThanOrEqual(38);
  });

  it("returns one empty row for an empty line", () => {
    expect(wrapLine("", [], plain, 38)).toEqual([{ lyric: "", placements: [] }]);
  });
});
