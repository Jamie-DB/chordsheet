import { describe, expect, it } from "vitest";
import type { ChordPlacement } from "../../shared/types";
import { normalizeSections } from "./normalize";

const p = (line: number, col: number, chord: string): ChordPlacement => ({ id: `${line}-${col}`, line, col, chord });

describe("normalizeSections", () => {
  it("collapses runs of blank lines to one", () => {
    const result = normalizeSections(["Verse line", "", "", "", "Chorus line"], [p(0, 0, "G"), p(4, 0, "C")]);
    expect(result.lyrics).toEqual(["Verse line", "", "Chorus line"]);
    expect(result.placements.map((x) => x.line)).toEqual([0, 2]);
    expect(result.changed).toBe(true);
  });

  it("strips leading and trailing blanks", () => {
    const result = normalizeSections(["", "", "Only line", "", ""], [p(2, 0, "G")]);
    expect(result.lyrics).toEqual(["Only line"]);
    expect(result.placements[0].line).toBe(0);
  });

  it("keeps blank lines that carry placements", () => {
    const result = normalizeSections(["[Intro]", "", "", "First words"], [p(1, 0, "G"), p(1, 4, "C")]);
    expect(result.lyrics).toEqual(["[Intro]", "", "", "First words"]);
    expect(result.changed).toBe(false);
  });

  it("collapses blanks around an instrumental line separately", () => {
    const lyrics = ["A words", "", "", "", "", "B words"];
    const placements = [p(2, 0, "G")];
    const result = normalizeSections(lyrics, placements);
    expect(result.lyrics).toEqual(["A words", "", "", "", "B words"]);
    expect(result.placements[0].line).toBe(2);
  });

  it("reports unchanged input as unchanged", () => {
    const lyrics = ["One", "", "Two"];
    const placements = [p(0, 0, "G")];
    const result = normalizeSections(lyrics, placements);
    expect(result.changed).toBe(false);
    expect(result.placements[0]).toBe(placements[0]);
  });
});
