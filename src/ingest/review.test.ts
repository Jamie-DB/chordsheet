import { describe, expect, it } from "vitest";
import type { Song } from "../shared/types";
import { groupLog, previewLines } from "./review";

describe("previewLines", () => {
  it("numbers each lyric line and puts its chord row above it", () => {
    const song = {
      lyrics: ["[Verse 1]", "Amazing grace, how sweet the sound"],
      placements: [
        { id: "p1", line: 1, col: 0, chord: "G" },
        { id: "p2", line: 1, col: 19, chord: "C" },
      ],
    } as Song;
    expect(previewLines(song)).toEqual([
      "  0 [Verse 1]",
      "    G                  C",
      "  1 Amazing grace, how sweet the sound",
    ]);
  });
});

describe("groupLog", () => {
  it("folds repeats into a count and keeps first-seen order", () => {
    expect(groupLog(["b", "a", "b"])).toEqual([
      { entry: "b", count: 2 },
      { entry: "a", count: 1 },
    ]);
  });
});
