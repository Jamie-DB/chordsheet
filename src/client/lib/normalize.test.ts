import { describe, expect, it } from "vitest";
import type { ChordPlacement } from "../../shared/types";
import { isPageArtifact, normalizeSections, stripPageLines } from "./normalize";

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

describe("isPageArtifact", () => {
  const artifacts = ["Page 1/3", "page 2/12", "Page 3 of 3", "  Page 10 / 12  "];
  it.each(artifacts)("matches %s", (line) => expect(isPageArtifact(line)).toBe(true));
  const keepers = ["Page turn here", "1/3", "On page one she wrote", "[Page]", "Turn the page"];
  it.each(keepers)("keeps %s", (line) => expect(isPageArtifact(line)).toBe(false));
});

describe("stripPageLines", () => {
  it("removes artifacts and remaps placements below", () => {
    const result = stripPageLines(
      ["First line", "Page 1/3", "Second line"],
      [p(0, 0, "C"), p(2, 4, "G")],
    );
    expect(result.lyrics).toEqual(["First line", "Second line"]);
    expect(result.placements.map((x) => x.line)).toEqual([0, 1]);
    expect(result.changed).toBe(true);
  });
  it("drops placements sitting on an artifact line", () => {
    const result = stripPageLines(["Words", "Page 2/2"], [p(1, 0, "C")]);
    expect(result.placements).toEqual([]);
  });
  it("leaves clean songs untouched", () => {
    const placements = [p(0, 0, "C")];
    const result = stripPageLines(["Words", "More words"], placements);
    expect(result.changed).toBe(false);
    expect(result.placements[0]).toBe(placements[0]);
  });
});
