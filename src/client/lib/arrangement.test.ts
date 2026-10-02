import { describe, expect, it } from "vitest";
import type { ChordPlacement, Song } from "../../shared/types";
import {
  MAX_REPEAT,
  OPENING,
  arrangeableSections,
  duplicateSection,
  fromBlocks,
  insertSection,
  moveSection,
  removeSection,
  sectionSummaries,
  setRepeat,
  stepTitle,
  toBlocks,
  toggleDiamonds,
  toggleOut,
} from "./arrangement";

// Every lyric here is public domain (It Is Well with My Soul, Amazing Grace, Holy Holy Holy).
const V1A = "When peace like a river attendeth my way,";
const V1B = "When sorrows like sea billows roll;";
const CHA = "It is well (it is well),";
const CHB = "With my soul (with my soul),";
const V2A = "Though Satan should buffet, though trials should come,";
const V4A = "Even so, it is well with my soul.";
const AG = "Amazing grace, how sweet the sound";
const HOLY = "Holy, holy, holy! Lord God Almighty!";

const pc = (id: string, line: number, chord: string, col = 0): ChordPlacement => ({ id, line, col, chord });

function mk(lyrics: string[], placements: ChordPlacement[] = [], extra: Partial<Song> = {}): Song {
  return {
    version: 1,
    id: "it-is-well",
    title: "It Is Well with My Soul",
    lyrics,
    placements,
    keyOverride: null,
    capo: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}

/**
 * 0 [Verse 1] / 1-2 verse / 3 blank / 4 [Chorus] / 5-6 chorus / 7 blank /
 * 8 [Verse 2] / 9 verse / 10 blank / 11 [Chorus] (bare repeat marker) /
 * 12 blank / 13 [Verse 4] / 14 verse
 */
const WELL = mk(
  ["[Verse 1]", V1A, V1B, "", "[Chorus]", CHA, CHB, "", "[Verse 2]", V2A, "", "[Chorus]", "", "[Verse 4]", V4A],
  [pc("v1", 1, "D"), pc("v1b", 2, "A", 5), pc("c1", 5, "D"), pc("c2", 6, "A", 4), pc("v2", 9, "D"), pc("v4", 14, "G")],
);

describe("stepTitle", () => {
  it.each([
    [OPENING, 1, "Opening"],
    [OPENING, 2, "Opening"],
    ["[Chorus]", 1, "Chorus"],
    ["[Chorus]", 2, "Chorus (2)"],
    ["[Verse 1]", 3, "Verse 1 (3)"],
  ])("%j occurrence %i is %j", (section, occurrence, title) => {
    expect(stepTitle(section, occurrence)).toBe(title);
  });
});

describe("arrangeableSections", () => {
  type Row = [string, string[], ChordPlacement[], Array<[string, number, number, number, boolean]>];
  const cases: Row[] = [
    ["empty song", [], [], []],
    ["unlabeled song is all opening", [AG, HOLY], [], [["", 1, 0, 1, true]]],
    [
      "unlabeled lines above the first label become the opening, trailing blank trimmed",
      [AG, "", "[Verse 1]", V1A],
      [],
      [
        ["", 1, 0, 0, true],
        ["[Verse 1]", 1, 3, 3, true],
      ],
    ],
    ["no opening when the song starts with a label", ["[Verse 1]", V1A], [], [["[Verse 1]", 1, 1, 1, true]]],
    ["no opening when only blanks precede the first label", ["", "", "[Verse 1]", V1A], [], [["[Verse 1]", 1, 3, 3, true]]],
    [
      "a blank opening line carrying a chord is an opening",
      ["", "[Verse 1]", V1A],
      [pc("intro", 0, "G")],
      [
        ["", 1, 0, 0, true],
        ["[Verse 1]", 1, 2, 2, true],
      ],
    ],
    ["trailing blank lines trimmed", ["[Verse 1]", V1A, "", ""], [], [["[Verse 1]", 1, 1, 1, true]]],
    [
      "a trailing blank line with a chord is kept, blanks below it trimmed",
      ["[Verse 1]", V1A, "", ""],
      [pc("tag", 2, "D")],
      [["[Verse 1]", 1, 1, 2, true]],
    ],
    [
      "a bare label mid song has no content",
      ["[Chorus]", CHA, "", "[Chorus]", "", "[Verse 4]", V4A],
      [],
      [
        ["[Chorus]", 1, 1, 1, true],
        ["[Chorus]", 2, 4, 3, false],
        ["[Verse 4]", 1, 6, 6, true],
      ],
    ],
    [
      "a bare label as the last line has no content",
      ["[Chorus]", CHA, "", "[Chorus]"],
      [],
      [
        ["[Chorus]", 1, 1, 1, true],
        ["[Chorus]", 2, 4, 3, false],
      ],
    ],
  ];
  it.each(cases)("%s", (_name, lyrics, placements, expected) => {
    const got = arrangeableSections(mk(lyrics, placements));
    expect(got.map((s) => [s.section, s.occurrence, s.start, s.end, s.hasContent])).toEqual(expected);
  });

  it("titles sections, numbering repeated labels", () => {
    expect(arrangeableSections(mk([AG, "[Chorus]", CHA, "[Chorus]", CHB])).map((s) => s.title)).toEqual([
      "Opening",
      "Chorus",
      "Chorus (2)",
    ]);
  });
});


describe("section operations", () => {
  const lyricsOf = (song: Song) => song.lyrics;
  const marked = (): Song => ({
    ...WELL,
    sectionMarks: [{ section: "[Chorus]", occurrence: 1, kind: "soft" }],
    outSections: [{ section: "[Verse 2]", occurrence: 1 }],
  });

  it("cuts a chart into blocks and lays it back out unchanged", () => {
    const blocks = toBlocks(WELL);
    expect(blocks.map((b) => b.label)).toEqual(["[Verse 1]", "[Chorus]", "[Verse 2]", "[Chorus]", "[Verse 4]"]);
    const again = fromBlocks(WELL, blocks);
    expect(again.lyrics).toEqual(WELL.lyrics);
    expect(again.placements).toEqual(WELL.placements);
  });

  it("carries marks and OUT flags with their blocks", () => {
    const blocks = toBlocks(marked());
    expect(blocks[1].mark).toEqual({ kind: "soft" });
    expect(blocks[2].out).toBe(true);
    expect(blocks[0].mark).toBeNull();
    expect(fromBlocks(marked(), blocks).sectionMarks).toEqual(marked().sectionMarks);
  });

  describe("moveSection", () => {
    it("swaps a section with its neighbour, chords and all, with one blank between", () => {
      const moved = moveSection(WELL, 0, 1);
      expect(lyricsOf(moved).slice(0, 7)).toEqual(["[Chorus]", CHA, CHB, "", "[Verse 1]", V1A, V1B]);
      // The chorus chords moved up to its new lines; the verse chords followed their lines down.
      expect(moved.placements.find((p) => p.id === "c1")).toMatchObject({ line: 1 });
      expect(moved.placements.find((p) => p.id === "v1")).toMatchObject({ line: 5 });
    });

    it("re-anchors a mark to the section it belongs to when same-named labels swap places", () => {
      const song = mk(
        ["[Chorus]", CHA, "", "[Verse 1]", V1A, "", "[Chorus]", CHB],
        [],
        { sectionMarks: [{ section: "[Chorus]", occurrence: 2, kind: "build" }] },
      );
      const moved = moveSection(song, 2, -2);
      expect(moved.lyrics[0]).toBe("[Chorus]");
      expect(moved.lyrics[1]).toBe(CHB);
      expect(moved.sectionMarks).toEqual([{ section: "[Chorus]", occurrence: 1, kind: "build" }]);
    });

    it("changes nothing past either end", () => {
      expect(moveSection(WELL, 0, -1)).toEqual(WELL);
      expect(moveSection(WELL, 4, 1)).toEqual(WELL);
      expect(moveSection(WELL, 9, 1)).toBe(WELL);
    });
  });

  describe("duplicateSection", () => {
    it("plays the section again right after itself with chords under fresh ids", () => {
      const doubled = duplicateSection(WELL, 1);
      expect(doubled.lyrics.slice(4, 12)).toEqual(["[Chorus]", CHA, CHB, "", "[Chorus]", CHA, CHB, ""]);
      const chorus = doubled.placements.filter((p) => p.line === 5 || p.line === 9);
      expect(chorus).toHaveLength(2);
      expect(new Set(doubled.placements.map((p) => p.id)).size).toBe(doubled.placements.length);
    });

    it("carries the mark and OUT flag to the copy", () => {
      const doubled = duplicateSection(marked(), 1);
      expect(doubled.sectionMarks).toEqual([
        { section: "[Chorus]", occurrence: 1, kind: "soft" },
        { section: "[Chorus]", occurrence: 2, kind: "soft" },
      ]);
    });
  });

  describe("removeSection", () => {
    it("drops the section, its chords, and its mark", () => {
      const removed = removeSection(marked(), 1);
      expect(removed.lyrics).not.toContain(CHA);
      expect(removed.placements.some((p) => p.id === "c1")).toBe(false);
      expect(removed.sectionMarks).toBeUndefined();
      expect(removed.outSections).toEqual([{ section: "[Verse 2]", occurrence: 1 }]);
    });

    it("leaves an empty chart when the last section goes", () => {
      expect(removeSection(mk(["[Verse 1]", V1A]), 0).lyrics).toEqual([]);
    });
  });

  describe("insertSection", () => {
    const source = toBlocks(mk(["[Bridge]", AG], [pc("x", 1, "G")], { outSections: [{ section: "[Bridge]", occurrence: 1 }] }))[0];

    it("puts a copied section at the index, clamped to the ends, with its OUT flag", () => {
      expect(insertSection(WELL, 1, source).lyrics.slice(3, 8)).toEqual(["", "[Bridge]", AG, "", "[Chorus]"]);
      expect(insertSection(WELL, 99, source).lyrics.at(-1)).toBe(AG);
      expect(insertSection(WELL, -4, source).lyrics[0]).toBe("[Bridge]");
      expect(insertSection(WELL, 0, source).outSections).toEqual([{ section: "[Bridge]", occurrence: 1 }]);
    });

    it("gives the copied chord a fresh id", () => {
      const inserted = insertSection(WELL, 0, source);
      expect(inserted.placements.find((p) => p.chord === "G" && p.line === 1)?.id).not.toBe("x");
    });
  });

  describe("setRepeat", () => {
    it("writes and clears an xN suffix on the label, clamped to MAX_REPEAT", () => {
      expect(setRepeat(WELL, 1, 3).lyrics[4]).toBe("[Chorus x3]");
      expect(setRepeat(setRepeat(WELL, 1, 3), 1, 1).lyrics[4]).toBe("[Chorus]");
      expect(setRepeat(WELL, 1, 99).lyrics[4]).toBe(`[Chorus x${MAX_REPEAT}]`);
      expect(setRepeat(WELL, 1, 0).lyrics[4]).toBe("[Chorus]");
    });

    it("keeps the section's mark under the renamed label", () => {
      expect(setRepeat(marked(), 1, 2).sectionMarks).toEqual([{ section: "[Chorus x2]", occurrence: 1, kind: "soft" }]);
    });

    it("labels an unlabeled opening so it can carry a count", () => {
      const song = mk([AG, "", "[Verse 1]", V1A], [pc("o", 0, "G")]);
      const repeated = setRepeat(song, 0, 2);
      expect(repeated.lyrics.slice(0, 2)).toEqual(["[Opening x2]", AG]);
      expect(repeated.placements.find((p) => p.id === "o")?.line).toBe(1);
    });
  });

  describe("toggleOut", () => {
    it("sets and clears an OUT section", () => {
      const on = toggleOut(WELL, 0);
      expect(on.outSections).toEqual([{ section: "[Verse 1]", occurrence: 1 }]);
      expect(toggleOut(on, 0).outSections).toBeUndefined();
    });

    it("labels an unlabeled opening so an OUT can anchor to it", () => {
      const out = toggleOut(mk([AG, "", "[Verse 1]", V1A]), 0);
      expect(out.lyrics[0]).toBe("[Opening]");
      expect(out.outSections).toEqual([{ section: "[Opening]", occurrence: 1 }]);
    });
  });

  describe("toggleDiamonds", () => {
    it("holds every chord in the section, then releases them all", () => {
      const held = toggleDiamonds(WELL, 1);
      expect(held.placements.filter((p) => p.line >= 4 && p.line <= 6).every((p) => p.hold === true)).toBe(true);
      expect(held.placements.filter((p) => p.line < 4).every((p) => p.hold === undefined)).toBe(true);
      expect(toggleDiamonds(held, 1).placements.every((p) => p.hold === undefined)).toBe(true);
    });

    it("holds the rest when only some chords are held", () => {
      const half = mk(["[Chorus]", CHA], [{ ...pc("a", 1, "D"), hold: true }, pc("b", 1, "A", 5)]);
      expect(toggleDiamonds(half, 0).placements.every((p) => p.hold === true)).toBe(true);
    });
  });

  describe("sectionSummaries", () => {
    it("reports title, repeat, OUT, diamonds, and lines for each section", () => {
      const song = toggleDiamonds(toggleOut(setRepeat(WELL, 1, 2), 0), 1);
      const [verse, chorus] = sectionSummaries(song);
      expect(verse).toMatchObject({ title: "Verse 1", repeat: 1, out: true, diamonds: false, labelLine: 0, start: 0, end: 2 });
      expect(chorus).toMatchObject({ title: "Chorus", repeat: 2, out: false, diamonds: true, labelLine: 4 });
    });

    it("lists an unlabeled opening first, with no label line", () => {
      const [opening, verse] = sectionSummaries(mk([AG, "", "[Verse 1]", V1A]));
      expect(opening).toMatchObject({ title: "Opening", labelLine: null, start: 0, end: 0 });
      expect(verse.labelLine).toBe(2);
    });
  });

  describe("an unlabeled opening placed after another section", () => {
    const opened = () => mk([AG, "", "[Verse 1]", V1A, "", "[Chorus]", CHA], [pc("o", 0, "G"), pc("v", 3, "D")]);
    const titles = (song: Song) => sectionSummaries(song).map((s) => s.title);

    it("takes an [Opening] label when moved later, instead of joining the section above", () => {
      const moved = moveSection(opened(), 0, 1);
      expect(moved.lyrics.slice(0, 5)).toEqual(["[Verse 1]", V1A, "", "[Opening]", AG]);
      expect(moved.placements.find((p) => p.id === "o")?.line).toBe(4);
      expect(titles(moved)).toEqual(["Verse 1", "Opening", "Chorus"]);
    });

    it("takes a label when the next section moves above it", () => {
      expect(titles(moveSection(opened(), 1, -1))).toEqual(["Verse 1", "Opening", "Chorus"]);
    });

    it("doubles into two sections, the copy labeled", () => {
      const doubled = duplicateSection(opened(), 0);
      expect(doubled.lyrics.slice(0, 4)).toEqual([AG, "", "[Opening]", AG]);
      expect(titles(doubled)).toEqual(["Opening", "Opening", "Verse 1", "Chorus"]);
    });

    it("copied in, stays its own section wherever it lands", () => {
      const opening = toBlocks(opened())[0];
      expect(titles(insertSection(opened(), 3, opening))).toEqual(["Opening", "Verse 1", "Chorus", "Opening"]);
      expect(titles(insertSection(opened(), 0, opening))).toEqual(["Opening", "Opening", "Verse 1", "Chorus"]);
    });

    it("stays unlabeled while it is first", () => {
      expect(moveSection(opened(), 1, 1).lyrics.slice(0, 3)).toEqual([AG, "", "[Chorus]"]);
    });
  });

  it("every layout leaves exactly one blank line between sections and none at the ends", () => {
    const messy = mk(["", "[Verse 1]", V1A, "", "", "", "[Chorus]", CHA, ""]);
    const out = fromBlocks(messy, toBlocks(messy));
    expect(out.lyrics).toEqual(["[Verse 1]", V1A, "", "[Chorus]", CHA]);
  });
});
