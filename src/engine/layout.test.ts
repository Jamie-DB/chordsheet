import { describe, expect, it } from "vitest";
import { buildChordRow, resolveAnchor } from "./layout";
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
});
