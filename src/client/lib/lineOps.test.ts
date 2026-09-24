import { describe, expect, it } from "vitest";
import type { Song } from "../../shared/types";
import { chordsOnLine, deleteLine, editLine, insertLine, isSectionLabel, retargetSections } from "./lineOps";

const song: Song = {
  version: 1,
  id: "t",
  title: "T",
  lyrics: ["[Verse]", "Morning light over the hill", "Water running cold and still"],
  placements: [
    { id: "a", line: 1, col: 0, chord: "C" },
    { id: "b", line: 1, col: 24, chord: "G" },
    { id: "c", line: 2, col: 0, chord: "Am" },
  ],
  keyOverride: null,
  capo: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("isSectionLabel", () => {
  it("matches bracketed lines only", () => {
    expect(isSectionLabel("[Verse]")).toBe(true);
    expect(isSectionLabel("  [Chorus 2]  ")).toBe(true);
    expect(isSectionLabel("Verse")).toBe(false);
    expect(isSectionLabel("[unclosed")).toBe(false);
    expect(isSectionLabel("")).toBe(false);
  });
});

describe("editLine", () => {
  it("replaces text and keeps chord columns, even past the new end", () => {
    const next = editLine(song, 1, "Morning light");
    expect(next.lyrics[1]).toBe("Morning light");
    expect(next.placements.find((p) => p.id === "a")!.col).toBe(0);
    expect(next.placements.find((p) => p.id === "b")!.col).toBe(24);
    expect(next.placements.find((p) => p.id === "c")!.col).toBe(0);
  });
  it("trims trailing whitespace and expands tabs", () => {
    expect(editLine(song, 0, "[Verse]\tx   ").lyrics[0]).toBe("[Verse]    x");
  });
});

describe("insertLine", () => {
  it("shifts chords on and below the insertion point", () => {
    const next = insertLine(song, 2);
    expect(next.lyrics).toEqual(["[Verse]", "Morning light over the hill", "", "Water running cold and still"]);
    expect(next.placements.find((p) => p.id === "b")!.line).toBe(1);
    expect(next.placements.find((p) => p.id === "c")!.line).toBe(3);
  });
});

describe("deleteLine", () => {
  it("drops the line's chords and shifts the rest up", () => {
    const next = deleteLine(song, 1);
    expect(next.lyrics).toEqual(["[Verse]", "Water running cold and still"]);
    expect(next.placements.map((p) => p.id).sort()).toEqual(["c"]);
    expect(next.placements[0].line).toBe(1);
  });
});

describe("chordsOnLine", () => {
  it("counts placements per line", () => {
    expect(chordsOnLine(song, 1)).toBe(2);
    expect(chordsOnLine(song, 0)).toBe(0);
  });
});

describe("section references follow a renamed label", () => {
  // It Is Well with My Soul, public domain.
  const well: Song = {
    ...song,
    lyrics: ["[Verse 1]", "When peace like a river attendeth my way,", "", "[Chorus]", "It is well (it is well),", "", "[Chorus]", "With my soul (with my soul),"],
    placements: [],
    sectionMarks: [
      { section: "[Chorus]", occurrence: 1, kind: "soft" },
      { section: "[Chorus]", occurrence: 2, kind: "full" },
    ],
    arrangements: [
      {
        id: "sep",
        name: "Sep",
        steps: [
          { section: "", occurrence: 1 },
          { section: "[Verse 1]", occurrence: 1 },
          { section: "[Chorus]", occurrence: 2, repeat: 2 },
        ],
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ],
  };

  it("renames marks and steps with the label", () => {
    const next = editLine(well, 0, "[Verse]");
    expect(next.arrangements?.[0].steps[1]).toEqual({ section: "[Verse]", occurrence: 1 });
    expect(next.sectionMarks).toEqual(well.sectionMarks);
  });

  it("shifts occurrences among equal labels", () => {
    const next = editLine(well, 3, "[Refrain]");
    expect(next.sectionMarks).toEqual([
      { section: "[Refrain]", occurrence: 1, kind: "soft" },
      { section: "[Chorus]", occurrence: 1, kind: "full" },
    ]);
    expect(next.arrangements?.[0].steps[2]).toEqual({ section: "[Chorus]", occurrence: 1, repeat: 2 });
    expect(next.arrangements?.[0].steps[0]).toEqual({ section: "", occurrence: 1 });
  });

  it("leaves references alone when a label appears or disappears", () => {
    const next = editLine(well, 3, "It is well");
    expect(next.sectionMarks).toEqual(well.sectionMarks);
    expect(next.arrangements).toEqual(well.arrangements);
  });

  it("returns the edited song untouched when no label changed", () => {
    const edited = editLine(well, 1, "When peace like a river");
    expect(edited.arrangements).toBe(well.arrangements);
    expect(retargetSections(well, well)).toBe(well);
  });
});
