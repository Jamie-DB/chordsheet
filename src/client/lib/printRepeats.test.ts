import { describe, expect, it } from "vitest";
import type { ChordPlacement, SectionMark, Song } from "../../shared/types";
import { collapseRepeats, ordinal, passBadge } from "./printRepeats";

// Public domain lyrics (It Is Well with My Soul).
const V1A = "When peace like a river attendeth my way,";
const CHA = "It is well (it is well),";
const CHB = "With my soul (with my soul),";

const pc = (id: string, line: number, chord: string, col = 0): ChordPlacement => ({ id, line, col, chord });
const soft: Omit<SectionMark, "section" | "occurrence"> = { kind: "soft" };
const full: Omit<SectionMark, "section" | "occurrence"> = { kind: "full" };
const mark = (section: string, occurrence: number, style: Omit<SectionMark, "section" | "occurrence">): SectionMark => ({
  section,
  occurrence,
  ...style,
});

function mk(lyrics: string[], placements: ChordPlacement[] = [], sectionMarks?: SectionMark[]): Song {
  return {
    version: 1,
    id: "it-is-well",
    title: "It Is Well with My Soul",
    lyrics,
    placements,
    sectionMarks,
    keyOverride: null,
    capo: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

// Verse, then the chorus twice (lines 3-5 and 7-9), chords the same both times.
const twice = ["[Verse 1]", V1A, "", "[Chorus]", CHA, CHB, "", "[Chorus]", CHA, CHB, ""];
const twiceChords = [pc("v", 1, "C"), pc("a", 4, "C"), pc("b", 5, "F", 3), pc("c", 8, "C"), pc("d", 9, "F", 3)];

describe("collapseRepeats", () => {
  it("prints back-to-back identical sections once, with each pass's dynamics", () => {
    const { song, passNotes } = collapseRepeats(
      mk(twice, twiceChords, [mark("[Verse 1]", 1, soft), mark("[Chorus]", 1, soft), mark("[Chorus]", 2, full)]),
    );
    expect(song.lyrics).toEqual(["[Verse 1]", V1A, "", "[Chorus x2]", CHA, CHB, ""]);
    expect(song.placements).toEqual([pc("v", 1, "C"), pc("a", 4, "C"), pc("b", 5, "F", 3)]);
    expect(song.sectionMarks).toEqual([mark("[Verse 1]", 1, soft)]);
    expect(passNotes.get(3)).toEqual([
      { passes: "1", mark: mark("[Chorus]", 1, soft) },
      { passes: "2", mark: mark("[Chorus]", 2, full) },
    ]);
  });

  it("keeps a shared mark on the merged section and lists no passes", () => {
    const { song, passNotes } = collapseRepeats(
      mk(twice, twiceChords, [mark("[Chorus]", 1, soft), mark("[Chorus]", 2, soft)]),
    );
    expect(song.lyrics[3]).toBe("[Chorus x2]");
    expect(song.sectionMarks).toEqual([mark("[Chorus x2]", 1, soft)]);
    expect(passNotes.size).toBe(0);
  });

  it("merges unmarked repeats into a plain x2", () => {
    const { song, passNotes } = collapseRepeats(mk(twice, twiceChords));
    expect(song.lyrics[3]).toBe("[Chorus x2]");
    expect(song.sectionMarks).toBeUndefined();
    expect(passNotes.size).toBe(0);
  });

  it("leaves unmarked passes out of the pass list", () => {
    const { passNotes } = collapseRepeats(mk(twice, twiceChords, [mark("[Chorus]", 1, soft)]));
    expect(passNotes.get(3)).toEqual([{ passes: "1", mark: mark("[Chorus]", 1, soft) }]);
  });

  it("adds an existing repeat count and groups runs of the same mark", () => {
    const lyrics = ["[Chorus x2]", CHA, "", "[Chorus]", CHA];
    const { song, passNotes } = collapseRepeats(
      mk(lyrics, [], [mark("[Chorus x2]", 1, soft), mark("[Chorus]", 1, full)]),
    );
    expect(song.lyrics).toEqual(["[Chorus x3]", CHA, ""]);
    expect(passNotes.get(0)?.map((n) => [n.passes, n.mark.kind])).toEqual([
      ["1-2", "soft"],
      ["3", "full"],
    ]);
  });

  it("renumbers later marks whose label occurrence shifted", () => {
    const lyrics = [...twice, "[Verse 2]", V1A, "", "[Chorus]", CHA, CHB];
    const { song } = collapseRepeats(
      mk(lyrics, twiceChords, [mark("[Verse 2]", 1, soft), mark("[Chorus]", 3, full)]),
    );
    expect(song.lyrics.filter((l) => l.startsWith("["))).toEqual(["[Verse 1]", "[Chorus x2]", "[Verse 2]", "[Chorus]"]);
    expect(song.sectionMarks).toEqual([mark("[Verse 2]", 1, soft), mark("[Chorus]", 1, full)]);
  });

  it.each([
    ["different chords", twice, [pc("a", 4, "C"), pc("c", 8, "G")]],
    ["a chord in a different column", twice, [pc("a", 4, "C"), pc("c", 8, "C", 2)]],
    ["different words", ["[Chorus]", CHA, "[Chorus]", CHB], []],
    ["different labels", ["[Chorus]", CHA, "[Outro]", CHA], []],
    ["a section in between", ["[Chorus]", CHA, "[Verse 1]", V1A, "[Chorus]", CHA], []],
    ["bare repeat markers", ["[Chorus]", "[Chorus]"], []],
    ["no labels at all", [CHA, CHA], []],
  ])("changes nothing for %s", (_, lyrics, placements) => {
    const input = mk(lyrics, placements);
    const { song, passNotes } = collapseRepeats(input);
    expect(song).toBe(input);
    expect(passNotes.size).toBe(0);
  });
});

describe("pass badges", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [101, "101st"],
    [111, "111th"],
  ])("%i is %s", (n, text) => {
    expect(ordinal(n)).toBe(text);
  });

  it("turns pass lists into ordinals", () => {
    expect(passBadge("1")).toBe("1st");
    expect(passBadge("2")).toBe("2nd");
    expect(passBadge("1-2")).toBe("1st-2nd");
    expect(passBadge("3-4")).toBe("3rd-4th");
  });
});

describe("collapseRepeats with out passes", () => {
  const outs = (song: Song, refs: Song["outSections"]): Song => ({ ...song, outSections: refs });

  it("never merges a pass the player sits out with one they play", () => {
    const { song } = collapseRepeats(outs(mk(twice, twiceChords), [{ section: "[Chorus]", occurrence: 1 }]));
    expect(song.lyrics).toEqual(twice);
    expect(song.outSections).toEqual([{ section: "[Chorus]", occurrence: 1 }]);
  });

  it("merges passes that are both out and keeps the merged label out", () => {
    const { song } = collapseRepeats(
      outs(mk(twice, twiceChords), [
        { section: "[Chorus]", occurrence: 1 },
        { section: "[Chorus]", occurrence: 2 },
      ]),
    );
    expect(song.lyrics).toEqual(["[Verse 1]", V1A, "", "[Chorus x2]", CHA, CHB, ""]);
    expect(song.outSections).toEqual([{ section: "[Chorus x2]", occurrence: 1 }]);
  });

  it("re-anchors outs whose occurrence shifts when earlier repeats merge", () => {
    const lyrics = [...twice, "[Chorus]", V1A];
    const { song } = collapseRepeats(outs(mk(lyrics, twiceChords), [{ section: "[Chorus]", occurrence: 3 }]));
    expect(song.lyrics).toEqual(["[Verse 1]", V1A, "", "[Chorus x2]", CHA, CHB, "", "[Chorus]", V1A]);
    expect(song.outSections).toEqual([{ section: "[Chorus]", occurrence: 1 }]);
  });
});
