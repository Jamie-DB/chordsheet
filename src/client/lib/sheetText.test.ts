import { describe, expect, it } from "vitest";
import type { Song } from "../../shared/types";
import { sheetText } from "./sheetText";
import { transposeSong } from "./songOps";

const song: Song = {
  version: 1,
  id: "t",
  title: "Test",
  artist: "Trad.",
  lyrics: ["Amazing grace, how sweet the sound", "no chords here"],
  placements: [
    { id: "1", line: 0, col: 0, chord: "G" },
    { id: "2", line: 0, col: 19, chord: "C" },
  ],
  keyOverride: null,
  capo: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("sheetText", () => {
  it("interleaves header, chord rows, and lyrics", () => {
    expect(sheetText(song, "G", "G")).toBe(
      [
        "Test",
        "Trad.",
        "Key: G",
        "",
        "G" + " ".repeat(18) + "C",
        "Amazing grace, how sweet the sound",
        "no chords here",
        "",
      ].join("\n"),
    );
  });

  it("renders capo shapes and header capo", () => {
    const capoed = { ...song, capo: 3 };
    const text = sheetText(capoed, "G", "E");
    expect(text).toContain("Key: G, Capo 3");
    expect(text).toContain("E" + " ".repeat(18) + "A");
  });

  it("wraps hold chords as <C> with the bracket borrowing a column", () => {
    const held = {
      ...song,
      placements: [
        { id: "1", line: 0, col: 0, chord: "G", hold: true },
        { id: "2", line: 0, col: 19, chord: "C", hold: true },
      ],
    };
    const text = sheetText(held, "G", "G");
    expect(text).toContain("<G>" + " ".repeat(15) + "<C>");
  });
});

describe("transposeSong", () => {
  it("moves chords and override together", () => {
    const up = transposeSong({ ...song, keyOverride: "G" }, "G", 2);
    expect(up.placements.map((p) => p.chord)).toEqual(["A", "D"]);
    expect(up.keyOverride).toBe("A");
    expect(up.capo).toBe(song.capo);
  });
  it("spells for the destination key", () => {
    const down = transposeSong(song, "G", -2);
    expect(down.placements.map((p) => p.chord)).toEqual(["F", "Bb"]);
  });
});
