import { describe, expect, it } from "vitest";
import type { Song } from "../../shared/types";
import { cleanSong } from "./cleanSong";

const base: Song = {
  version: 1,
  id: "amazing-grace",
  title: "Amazing Grace",
  lyrics: ["[Verse 1]", "Amazing grace, how sweet the sound", "That saved a wretch like me"],
  placements: [{ id: "p1", line: 1, col: 0, chord: "G" }],
  keyOverride: null,
  capo: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("cleanSong", () => {
  it("returns a clean song unchanged, as the same object", () => {
    const result = cleanSong(base);
    expect(result.changed).toBe(false);
    expect(result.song).toBe(base);
    expect(result.chordLinesConverted).toBe(0);
    expect(result.labelNotesPromoted).toBe(0);
  });

  it("strips page lines, repairs chord text, normalizes spacing, and promotes label notes", () => {
    const messy: Song = {
      ...base,
      lyrics: [
        "",
        "[Verse 1] *soft*",
        "G   C   G",
        "Amazing grace, how sweet the sound",
        "Page 1/2",
        "",
        "",
        "That saved a wretch like me",
        "",
      ],
      placements: [],
    };
    const result = cleanSong(messy);
    expect(result.changed).toBe(true);
    expect(result.song.lyrics).toEqual([
      "[Verse 1]",
      "Amazing grace, how sweet the sound",
      "",
      "That saved a wretch like me",
    ]);
    expect(result.song.placements.map((p) => `${p.chord}@${p.line}:${p.col}`)).toEqual([
      "G@1:0",
      "C@1:4",
      "G@1:8",
    ]);
    expect(result.song.sectionMarks).toEqual([
      { section: "[Verse 1]", occurrence: 1, kind: "soft", text: "soft" },
    ]);
    expect(result.chordLinesConverted).toBe(1);
    expect(result.labelNotesPromoted).toBe(1);
    expect(result.song.updatedAt).toBe(base.updatedAt);
  });

  it("is idempotent", () => {
    const messy: Song = {
      ...base,
      lyrics: ["[Verse 1] *soft*", "", "", ...base.lyrics.slice(1)],
      placements: [{ id: "p1", line: 3, col: 0, chord: "G" }],
    };
    const once = cleanSong(messy).song;
    const twice = cleanSong(once);
    expect(twice.changed).toBe(false);
    expect(twice.song).toBe(once);
  });
});
