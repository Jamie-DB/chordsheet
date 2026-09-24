import { describe, expect, it } from "vitest";
import type { Song } from "../../shared/types";
import { chordsOnLine, deleteLine, editLine, insertLine, isSectionLabel, matchLines, replaceLyrics, stepsUsingLabel } from "./lineOps";

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

describe("section references follow their label line", () => {
  // It Is Well with My Soul, public domain.
  const V = "When peace like a river attendeth my way,";
  const A = "It is well (it is well),";
  const B = "With my soul (with my soul),";
  const steps = (song: Song) => song.arrangements?.[0].steps;
  const well: Song = {
    ...song,
    // 0 [Verse 1] / 1 / 2 blank / 3 [Chorus] / 4 / 5 blank / 6 [Chorus] / 7
    lyrics: ["[Verse 1]", V, "", "[Chorus]", A, "", "[Chorus]", B],
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
          { section: "[Chorus]", occurrence: 1 },
          { section: "[Chorus]", occurrence: 2, note: "last" },
        ],
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ],
  };

  it.each<[string, (s: Song) => Song, Song["sectionMarks"], ReturnType<typeof steps>]>([
    [
      "an in-place rename carries marks and steps",
      (s) => editLine(s, 0, "[Verse]"),
      well.sectionMarks,
      [{ section: "", occurrence: 1 }, { section: "[Verse]", occurrence: 1 }, { section: "[Chorus]", occurrence: 1 }, { section: "[Chorus]", occurrence: 2, note: "last" }],
    ],
    [
      "renaming the first of two equal labels shifts the second's occurrence",
      (s) => editLine(s, 3, "[Refrain]"),
      [{ section: "[Refrain]", occurrence: 1, kind: "soft" }, { section: "[Chorus]", occurrence: 1, kind: "full" }],
      [{ section: "", occurrence: 1 }, { section: "[Verse 1]", occurrence: 1 }, { section: "[Refrain]", occurrence: 1 }, { section: "[Chorus]", occurrence: 1, note: "last" }],
    ],
    [
      // The review's probe: deleting the first [Chorus] label must not slide its step onto the second.
      "deleting a label drops its references and shifts the later equal label's",
      (s) => deleteLine(s, 3),
      [{ section: "[Chorus]", occurrence: 1, kind: "full" }],
      [{ section: "", occurrence: 1 }, { section: "[Verse 1]", occurrence: 1 }, { section: "[Chorus]", occurrence: 1, note: "last" }],
    ],
    [
      "rewriting a label as a lyric drops its references the same way",
      (s) => editLine(s, 3, "It is well"),
      [{ section: "[Chorus]", occurrence: 1, kind: "full" }],
      [{ section: "", occurrence: 1 }, { section: "[Verse 1]", occurrence: 1 }, { section: "[Chorus]", occurrence: 1, note: "last" }],
    ],
    [
      "a new equal label typed above existing ones pushes their occurrences down",
      (s) => editLine(insertLine(s, 2), 2, "[Chorus]"),
      [{ section: "[Chorus]", occurrence: 2, kind: "soft" }, { section: "[Chorus]", occurrence: 3, kind: "full" }],
      [{ section: "", occurrence: 1 }, { section: "[Verse 1]", occurrence: 1 }, { section: "[Chorus]", occurrence: 2 }, { section: "[Chorus]", occurrence: 3, note: "last" }],
    ],
    [
      "deleting a lyric line moves nothing",
      (s) => deleteLine(s, 4),
      well.sectionMarks,
      steps(well),
    ],
  ])("%s", (_name, edit, marks, expected) => {
    const next = edit(well);
    expect(next.sectionMarks).toEqual(marks);
    expect(steps(next)).toEqual(expected);
  });

  it.each([[3, 1], [6, 1], [0, 1], [1, 0], [2, 0]])("line %i is played by %i version step(s)", (line, n) => {
    expect(stepsUsingLabel(well, line)).toBe(n);
  });

  it("keeps the same objects when no label moved", () => {
    const edited = editLine(well, 1, "When peace like a river");
    expect(edited.arrangements).toBe(well.arrangements);
    expect(edited.sectionMarks).toBe(well.sectionMarks);
  });

  it("clears sectionMarks when the last mark's label is deleted", () => {
    const one: Song = { ...well, sectionMarks: [{ section: "[Chorus]", occurrence: 1, kind: "soft" }] };
    expect(deleteLine(one, 3).sectionMarks).toBeUndefined();
  });

  describe("replaceLyrics (whole-text edit)", () => {
    it.each<[string, string[], Song["sectionMarks"], ReturnType<typeof steps>, number]>([
      [
        "deleting a label drops its references and shifts the later equal label's",
        ["[Verse 1]", V, "", A, "", "[Chorus]", B],
        [{ section: "[Chorus]", occurrence: 1, kind: "full" }],
        [{ section: "", occurrence: 1 }, { section: "[Verse 1]", occurrence: 1 }, { section: "[Chorus]", occurrence: 1, note: "last" }],
        2,
      ],
      [
        "renaming both equal labels pairs them in order",
        ["[Verse 1]", V, "", "[Refrain]", A, "", "[Refrain]", B],
        [{ section: "[Refrain]", occurrence: 1, kind: "soft" }, { section: "[Refrain]", occurrence: 2, kind: "full" }],
        [{ section: "", occurrence: 1 }, { section: "[Verse 1]", occurrence: 1 }, { section: "[Refrain]", occurrence: 1 }, { section: "[Refrain]", occurrence: 2, note: "last" }],
        0,
      ],
      [
        "renaming one of two equal labels follows the renamed one",
        ["[Verse 1]", V, "", "[Chorus]", A, "", "[Last Chorus]", B],
        [{ section: "[Chorus]", occurrence: 1, kind: "soft" }, { section: "[Last Chorus]", occurrence: 1, kind: "full" }],
        [{ section: "", occurrence: 1 }, { section: "[Verse 1]", occurrence: 1 }, { section: "[Chorus]", occurrence: 1 }, { section: "[Last Chorus]", occurrence: 1, note: "last" }],
        0,
      ],
      [
        "adding a label and words above moves every later reference with its line",
        ["[Chorus]", A, "", "[Verse 1]", V, "", "[Chorus]", A, "", "[Chorus]", B],
        [{ section: "[Chorus]", occurrence: 2, kind: "soft" }, { section: "[Chorus]", occurrence: 3, kind: "full" }],
        [{ section: "", occurrence: 1 }, { section: "[Verse 1]", occurrence: 1 }, { section: "[Chorus]", occurrence: 2 }, { section: "[Chorus]", occurrence: 3, note: "last" }],
        0,
      ],
    ])("%s", (_name, lines, marks, expected, dropped) => {
      const result = replaceLyrics(well, lines);
      expect(result.song.sectionMarks).toEqual(marks);
      expect(steps(result.song)).toEqual(expected);
      expect(result.droppedRefs).toBe(dropped);
    });

    it("drops chords whose line is gone and normalizes spacing", () => {
      const withChords: Song = { ...well, placements: [{ id: "x", line: 7, col: 0, chord: "D" }, { id: "y", line: 1, col: 0, chord: "G" }] };
      const result = replaceLyrics(withChords, ["[Verse 1]", V, "", "", "[Chorus]", A]);
      expect(result.droppedChords).toBe(1);
      expect(result.song.lyrics).toEqual(["[Verse 1]", V, "", "[Chorus]", A]);
      expect(result.song.placements).toEqual([{ id: "y", line: 1, col: 0, chord: "G" }]);
    });
  });
});

describe("matchLines", () => {
  it.each<[string[], string[], Array<[number, number]>]>([
    [["a", "b", "c"], ["a", "b", "c"], [[0, 0], [1, 1], [2, 2]]],
    [["a", "b", "c"], ["a", "c"], [[0, 0], [2, 1]]],
    [["a", "c"], ["a", "b", "c"], [[0, 0], [1, 2]]],
    [["a", "b"], ["x", "y"], []],
    [[], ["a"], []],
  ])("%j to %j", (before, after, pairs) => {
    expect([...matchLines(before, after)]).toEqual(pairs);
  });
});
