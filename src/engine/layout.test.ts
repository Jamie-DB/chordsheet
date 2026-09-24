import { describe, expect, it } from "vitest";
import { buildChordRow, buildChordRowSegments, resolveAnchor } from "./layout";
import type { ChordPlacement } from "../shared/types";

const p = (col: number, chord: string): ChordPlacement => ({ id: `${col}-${chord}`, line: 0, col, chord });

describe("buildChordRow", () => {
  it("places chords at their columns", () => {
    expect(buildChordRow([p(0, "G"), p(8, "C")])).toBe("G       C");
  });
  it("handles a chord at column 0 and unsorted input", () => {
    expect(buildChordRow([p(8, "C"), p(0, "G")])).toBe("G       C");
  });
  it("shifts collisions right with one space between symbols", () => {
    expect(buildChordRow([p(0, "Am7"), p(1, "G")])).toBe("Am7 G");
    expect(buildChordRow([p(0, "C"), p(0, "G"), p(0, "D")])).toBe("C G D");
  });
  it("allows chords past the lyric end", () => {
    expect(buildChordRow([p(20, "D")])).toBe(" ".repeat(20) + "D");
  });
  it("applies the render transform", () => {
    expect(buildChordRow([p(0, "Eb")], (c) => c + "*")).toBe("Eb*");
  });
  it("returns an empty row for no placements", () => {
    expect(buildChordRow([])).toBe("");
  });
  it("skips a chord the render transform empties", () => {
    expect(buildChordRow([p(0, "G"), p(4, "C")], (c) => (c === "G" ? "" : c))).toBe("    C");
  });
  it("clamps a negative column to the row start", () => {
    expect(buildChordRow([p(-3, "G"), p(4, "C")])).toBe("G   C");
    expect(buildChordRow([p(0, "G"), p(-1, "C")])).toBe("C G");
  });
});

describe("buildChordRowSegments", () => {
  it("partitions into gaps and chords, marking holds", () => {
    const segments = buildChordRowSegments([
      { id: "1", line: 0, col: 2, chord: "G", hold: true },
      { id: "2", line: 0, col: 8, chord: "C" },
    ]);
    expect(segments).toEqual([
      { text: "  ", hold: false },
      { text: "G", hold: true },
      { text: "     ", hold: false },
      { text: "C", hold: false },
    ]);
  });
  it("joins back to the exact plain row", () => {
    const placements = [p(0, "Am7"), p(1, "G"), p(20, "D")];
    expect(
      buildChordRowSegments(placements)
        .map((s) => s.text)
        .join(""),
    ).toBe(buildChordRow(placements));
  });
  it("passes hold to the render callback", () => {
    const row = buildChordRow(
      [{ id: "1", line: 0, col: 3, chord: "C", hold: true }],
      (chord, hold) => (hold ? `<${chord}>` : chord),
    );
    expect(row).toBe("   <C>");
  });
});

describe("resolveAnchor", () => {
  const line = "Amazing grace, how sweet the sound that saved a wretch like me";
  it("finds an exact anchor", () => {
    expect(resolveAnchor(line, "sweet")).toBe(line.indexOf("sweet"));
  });
  it("applies offsetInAnchor", () => {
    expect(resolveAnchor(line, "sweet the", 1, 6)).toBe(line.indexOf("sweet") + 6);
  });
  it("finds the nth occurrence", () => {
    const twice = "la la land";
    expect(resolveAnchor(twice, "la", 2)).toBe(3);
    expect(resolveAnchor(twice, "la", 3)).toBe(6);
  });
  it("falls back to case-insensitive", () => {
    expect(resolveAnchor(line, "AMAZING")).toBe(0);
  });
  it("falls back to the anchor's first word", () => {
    expect(resolveAnchor(line, "sweet melody")).toBe(line.indexOf("sweet"));
  });
  it("returns null when nothing matches", () => {
    expect(resolveAnchor(line, "banana")).toBeNull();
    expect(resolveAnchor(line, "")).toBeNull();
    expect(resolveAnchor(line, "la", 9)).toBeNull();
  });
  it("clamps the offset to the line", () => {
    expect(resolveAnchor("hi", "hi", 1, 99)).toBe(2);
  });
  it("ignores a negative offset", () => {
    expect(resolveAnchor(line, "sweet", 1, -4)).toBe(line.indexOf("sweet"));
  });

  // "holy Lord" is not in the line, so every case below takes the first-word fallback.
  const holy = "Holy, holy, holy! Lord God Almighty!";
  it.each([
    ["first exact occurrence", 1, 0, 6],
    ["second exact occurrence", 2, 0, 12],
    ["offset inside the first word is kept", 2, 2, 14],
    ["offset at the end of the first word is kept", 2, 4, 16],
    ["offset past the first word is dropped", 2, 6, 12],
    ["third occurrence falls back to case-insensitive", 3, 0, 12],
    ["no fourth occurrence", 4, 0, null],
  ] as const)("first-word fallback: %s", (_name, occurrence, offset, col) => {
    expect(resolveAnchor(holy, "holy Lord", occurrence, offset)).toBe(col);
  });
});
