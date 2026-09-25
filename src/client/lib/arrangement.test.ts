import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Arrangement, ArrangementStep, ChordPlacement, SectionMark, Song } from "../../shared/types";
import {
  MAX_REPEAT,
  OPENING,
  arrangeableSections,
  createArrangement,
  defaultSteps,
  duplicateStep,
  moveStep,
  removeStep,
  renderArrangement,
  resolveStep,
  stepTitle,
  updateStep,
  withArrangement,
  withoutArrangement,
} from "./arrangement";
import { isSectionLabel } from "./lineOps";
import { sectionRanges } from "./sectionMarks";

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

function arr(steps: ArrangementStep[], id = "a"): Arrangement {
  return { id, name: id, steps, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
}

const step = (section: string, occurrence = 1, rest: Partial<ArrangementStep> = {}): ArrangementStep => ({
  section,
  occurrence,
  ...rest,
});

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

describe("defaultSteps", () => {
  it("is every section once in song order, bare labels included", () => {
    expect(defaultSteps(WELL)).toEqual([
      step("[Verse 1]"),
      step("[Chorus]"),
      step("[Verse 2]"),
      step("[Chorus]", 2),
      step("[Verse 4]"),
    ]);
  });
  it("includes the opening when present", () => {
    expect(defaultSteps(mk([AG, "[Verse 1]", V1A]))).toEqual([step(OPENING), step("[Verse 1]")]);
  });
  it("is empty for an empty song", () => {
    expect(defaultSteps(mk([]))).toEqual([]);
  });
});

describe("resolveStep", () => {
  const sections = arrangeableSections(WELL);
  const lonely = arrangeableSections(mk(["[Verse 1]", V1A, "", "[Tag]"]));
  it.each<[string, ReturnType<typeof arrangeableSections>, ArrangementStep, [string, number] | null]>([
    ["a section with content resolves to itself", sections, step("[Chorus]"), ["[Chorus]", 1]],
    ["a bare label borrows the first same-label section with content", sections, step("[Chorus]", 2), ["[Chorus]", 1]],
    ["a bare label with no content anywhere resolves to itself", lonely, step("[Tag]"), ["[Tag]", 1]],
    ["a missing occurrence is null", sections, step("[Chorus]", 3), null],
    ["a missing label is null", sections, step("[Bridge]"), null],
    ["an opening step with no opening is null", sections, step(OPENING), null],
  ])("%s", (_name, list, s, expected) => {
    const got = resolveStep(list, s);
    expect(got ? [got.section, got.occurrence] : null).toEqual(expected);
  });
});

describe("renderArrangement", () => {
  it("renders the default arrangement with one blank between steps and none at the ends", () => {
    const { song, missing } = renderArrangement(WELL, arr(defaultSteps(WELL)));
    expect(missing).toEqual([]);
    expect(song.lyrics).toEqual([
      "[Verse 1]", V1A, V1B,
      "",
      "[Chorus]", CHA, CHB,
      "",
      "[Verse 2]", V2A,
      "",
      "[Chorus]", CHA, CHB, // the bare repeat marker plays the chorus
      "",
      "[Verse 4]", V4A,
    ]);
  });

  it("reports missing steps by index and skips them without extra blanks", () => {
    const { song, missing } = renderArrangement(
      WELL,
      arr([step("[Bridge]"), step("[Verse 1]"), step("[Chorus]", 9), step("[Verse 4]"), step(OPENING)]),
    );
    expect(missing).toEqual([0, 2, 4]);
    expect(song.lyrics).toEqual(["[Verse 1]", V1A, V1B, "", "[Verse 4]", V4A]);
  });

  it("renders an empty song for an empty or all-missing arrangement", () => {
    expect(renderArrangement(WELL, arr([])).song.lyrics).toEqual([]);
    const all = renderArrangement(WELL, arr([step("[Bridge]")]));
    expect(all.song.lyrics).toEqual([]);
    expect(all.song.placements).toEqual([]);
    expect(all.missing).toEqual([0]);
  });

  it.each<[string, Partial<ArrangementStep>, string[]]>([
    ["repeat 1 renders plain", { repeat: 1 }, ["[Chorus]", CHA, CHB]],
    ["repeat 2 renders x2", { repeat: 2 }, ["[Chorus x2]", CHA, CHB]],
    ["a note renders right after the label", { note: "vamp while the pastor speaks" }, ["[Chorus]", "(vamp while the pastor speaks)", CHA, CHB]],
    ["a note is trimmed", { note: "  softly  " }, ["[Chorus]", "(softly)", CHA, CHB]],
    ["a blank note renders nothing", { note: "   " }, ["[Chorus]", CHA, CHB]],
    ["repeat and note together", { repeat: 3, note: "build" }, ["[Chorus x3]", "(build)", CHA, CHB]],
  ])("%s", (_name, rest, expected) => {
    expect(renderArrangement(WELL, arr([step("[Chorus]", 1, rest)])).song.lyrics).toEqual(expected);
  });

  describe("the opening block", () => {
    const opened = mk([AG, "", "[Verse 1]", V1A], [pc("o", 0, "G"), pc("v", 3, "D")]);
    it.each<[string, Partial<ArrangementStep>, string[]]>([
      ["is unlabeled when plain", {}, [AG, "", "[Verse 1]", V1A]],
      ["is labeled when repeated", { repeat: 2 }, ["[Opening x2]", AG, "", "[Verse 1]", V1A]],
      ["is labeled when it has a note", { note: "guitar alone" }, ["[Opening]", "(guitar alone)", AG, "", "[Verse 1]", V1A]],
      ["is labeled when it carries a mark", { mark: { kind: "soft" } }, ["[Opening]", AG, "", "[Verse 1]", V1A]],
      ["stays unlabeled when its mark is cleared", { mark: null }, [AG, "", "[Verse 1]", V1A]],
    ])("%s", (_name, rest, expected) => {
      const { song } = renderArrangement(opened, arr([step(OPENING, 1, rest), step("[Verse 1]")]));
      expect(song.lyrics).toEqual(expected);
    });

    it("is labeled when it plays after another section it would otherwise join", () => {
      const { song } = renderArrangement(opened, arr([step("[Verse 1]"), step(OPENING)]));
      expect(song.lyrics).toEqual(["[Verse 1]", V1A, "", "[Opening]", AG]);
      expect(sectionRanges(song.lyrics).map((r) => r.label)).toEqual(["[Verse 1]", "[Opening]"]);
      expect(song.placements).toEqual([
        { id: "v~0", line: 1, col: 0, chord: "D" },
        { id: "o~1", line: 4, col: 0, chord: "G" },
      ]);
    });

    it("skips blank lines above the opening's first content", () => {
      const padded = mk(["", AG, "", "[Verse 1]", V1A], [pc("o", 1, "G")]);
      expect(arrangeableSections(padded)[0]).toMatchObject({ section: OPENING, start: 1, end: 1 });
      const { song } = renderArrangement(padded, arr([step(OPENING), step("[Verse 1]")]));
      expect(song.lyrics).toEqual([AG, "", "[Verse 1]", V1A]);
      expect(song.placements).toEqual([{ id: "o~0", line: 0, col: 0, chord: "G" }]);
    });

    it("stays unlabeled when only missing steps come before it", () => {
      const { song, missing } = renderArrangement(opened, arr([step("[Bridge]"), step(OPENING), step("[Verse 1]")]));
      expect(missing).toEqual([0]);
      expect(song.lyrics).toEqual([AG, "", "[Verse 1]", V1A]);
    });

    it("numbers repeated opening labels", () => {
      const { song } = renderArrangement(
        opened,
        arr([step(OPENING), step("[Verse 1]"), step(OPENING, 1, { mark: { kind: "soft" } }), step(OPENING, 1, { mark: { kind: "full" } })]),
      );
      expect(song.lyrics).toEqual([AG, "", "[Verse 1]", V1A, "", "[Opening]", AG, "", "[Opening]", AG]);
      expect(song.sectionMarks).toEqual([
        { section: "[Opening]", occurrence: 1, kind: "soft" },
        { section: "[Opening]", occurrence: 2, kind: "full" },
      ]);
    });
  });

  it("keeps a trailing blank line that carries a chord, and its chord", () => {
    const s = mk(["[Verse 1]", V1A, "", "", "[Chorus]", CHA], [pc("v", 1, "D"), pc("tag", 2, "A", 3)]);
    const { song } = renderArrangement(s, arr([step("[Verse 1]"), step("[Chorus]")]));
    expect(song.lyrics).toEqual(["[Verse 1]", V1A, "", "", "[Chorus]", CHA]);
    expect(song.placements).toEqual([
      { id: "v~0", line: 1, col: 0, chord: "D" },
      { id: "tag~0", line: 2, col: 3, chord: "A" },
    ]);
  });

  it("copies placements with remapped lines and ids unique across duplicated steps", () => {
    const { song } = renderArrangement(
      WELL,
      arr([step("[Chorus]", 1, { note: "soft" }), step("[Chorus]"), step("[Chorus]", 2), step("[Verse 4]")]),
    );
    expect(song.lyrics).toEqual([
      "[Chorus]", "(soft)", CHA, CHB,
      "",
      "[Chorus]", CHA, CHB,
      "",
      "[Chorus]", CHA, CHB,
      "",
      "[Verse 4]", V4A,
    ]);
    expect(song.placements).toEqual([
      { id: "c1~0", line: 2, col: 0, chord: "D" },
      { id: "c2~0", line: 3, col: 4, chord: "A" },
      { id: "c1~1", line: 6, col: 0, chord: "D" },
      { id: "c2~1", line: 7, col: 4, chord: "A" },
      { id: "c1~2", line: 10, col: 0, chord: "D" },
      { id: "c2~2", line: 11, col: 4, chord: "A" },
      { id: "v4~3", line: 14, col: 0, chord: "G" },
    ]);
    const ids = song.placements.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of song.placements) {
      const src = WELL.placements.find((q) => q.id === p.id.split("~")[0])!;
      expect(song.lyrics[p.line]).toBe(WELL.lyrics[src.line]);
    }
  });

  it("carries hold flags on copied placements", () => {
    const s = mk(["[Verse 1]", V1A], [{ ...pc("h", 1, "D"), hold: true }]);
    expect(renderArrangement(s, arr([step("[Verse 1]")])).song.placements).toEqual([
      { id: "h~0", line: 1, col: 0, chord: "D", hold: true },
    ]);
  });

  it("clears arrangements on the rendered song and keeps the other fields", () => {
    const source = withArrangement({ ...WELL, capo: 3, keyOverride: "Eb" }, arr(defaultSteps(WELL), "x"));
    const { song } = renderArrangement(source, source.arrangements![0]);
    expect(song.arrangements).toBeUndefined();
    expect(song.capo).toBe(3);
    expect(song.keyOverride).toBe("Eb");
    expect(song.id).toBe(WELL.id);
  });

  describe("section marks", () => {
    const soft: SectionMark = { section: "[Chorus]", occurrence: 1, kind: "soft" };
    const bareFull: SectionMark = { section: "[Chorus]", occurrence: 2, kind: "full" };
    const verseCustom: SectionMark = { section: "[Verse 1]", occurrence: 1, kind: "custom", text: "swell", color: "blue" };
    const marked = { ...WELL, sectionMarks: [soft, verseCustom] };

    const render = (s: Song, steps: ArrangementStep[]) => renderArrangement(s, arr(steps)).song.sectionMarks;

    it("is undefined when nothing is marked", () => {
      expect(render(WELL, defaultSteps(WELL))).toBeUndefined();
    });

    it("inherits the source section's mark, text and color included", () => {
      expect(render(marked, [step("[Verse 1]"), step("[Chorus]")])).toEqual([
        { section: "[Verse 1]", occurrence: 1, kind: "custom", text: "swell", color: "blue" },
        { section: "[Chorus]", occurrence: 1, kind: "soft" },
      ]);
    });

    it("a bare repeat marker inherits the borrowed section's mark", () => {
      expect(render(marked, [step("[Chorus]", 2)])).toEqual([{ section: "[Chorus]", occurrence: 1, kind: "soft" }]);
    });

    it("a bare repeat marker's own mark wins over the borrowed section's", () => {
      expect(render({ ...WELL, sectionMarks: [soft, bareFull] }, [step("[Chorus]", 2)])).toEqual([
        { section: "[Chorus]", occurrence: 1, kind: "full" },
      ]);
    });

    it("a step mark overrides the inherited one", () => {
      expect(render(marked, [step("[Chorus]", 1, { mark: { kind: "tacet" } })])).toEqual([
        { section: "[Chorus]", occurrence: 1, kind: "tacet" },
      ]);
    });

    it("a step mark applies where the section has none", () => {
      expect(render(WELL, [step("[Verse 2]", 1, { mark: { kind: "custom", text: "drop", color: "red" } })])).toEqual([
        { section: "[Verse 2]", occurrence: 1, kind: "custom", text: "drop", color: "red" },
      ]);
    });

    it("a null step mark clears the inherited one", () => {
      expect(render(marked, [step("[Chorus]", 1, { mark: null })])).toBeUndefined();
    });

    it("counts occurrences among identical rendered labels", () => {
      expect(
        render(marked, [
          step("[Chorus]"),
          step("[Chorus]", 1, { repeat: 2 }),
          step("[Chorus]", 2),
          step("[Chorus]", 1, { repeat: 2, mark: { kind: "build" } }),
        ]),
      ).toEqual([
        { section: "[Chorus]", occurrence: 1, kind: "soft" },
        { section: "[Chorus x2]", occurrence: 1, kind: "soft" },
        { section: "[Chorus]", occurrence: 2, kind: "soft" },
        { section: "[Chorus x2]", occurrence: 2, kind: "build" },
      ]);
    });

    it("anchors a mark on a labeled opening to its rendered label", () => {
      const s = mk([AG, "[Verse 1]", V1A]);
      expect(render(s, [step(OPENING, 1, { repeat: 2, mark: { kind: "soft" } })])).toEqual([
        { section: "[Opening x2]", occurrence: 1, kind: "soft" },
      ]);
    });
  });

  it("every rendered label is a section that sectionRanges recognizes, and marks anchor to one", () => {
    const s = mk(
      [AG, "", ...WELL.lyrics],
      WELL.placements.map((p) => ({ ...p, line: p.line + 2 })),
      { sectionMarks: [{ section: "[Chorus]", occurrence: 1, kind: "soft" }] },
    );
    const steps: ArrangementStep[] = [
      step(OPENING, 1, { repeat: 2, note: "guitar alone" }),
      step("[Verse 1]"),
      step("[Chorus]", 1, { repeat: 2 }),
      step("[Verse 2]", 1, { note: "half time" }),
      step("[Chorus]", 2),
      step("[Chorus]"),
      step("[Bridge]"),
      step("[Verse 4]", 1, { repeat: 3, mark: { kind: "full" } }),
    ];
    const { song, missing } = renderArrangement(s, arr(steps));
    expect(missing).toEqual([6]);

    const labels = song.lyrics.filter(isSectionLabel);
    expect(labels).toEqual(["[Opening x2]", "[Verse 1]", "[Chorus x2]", "[Verse 2]", "[Chorus]", "[Chorus]", "[Verse 4 x3]"]);

    const ranges = sectionRanges(song.lyrics);
    expect(ranges.map((r) => r.label)).toEqual(labels);
    expect(ranges[0].start).toBe(0);
    expect(ranges.map((r) => `${r.label}#${r.occurrence}`)).toContain("[Chorus]#2");

    for (const m of song.sectionMarks ?? []) {
      expect(ranges.some((r) => r.label === m.section && r.occurrence === m.occurrence)).toBe(true);
    }
    expect(song.sectionMarks).toEqual([
      { section: "[Chorus x2]", occurrence: 1, kind: "soft" },
      { section: "[Chorus]", occurrence: 1, kind: "soft" },
      { section: "[Chorus]", occurrence: 2, kind: "soft" },
      { section: "[Verse 4 x3]", occurrence: 1, kind: "full" },
    ]);

    // Re-deriving sections from the rendered song finds the same blocks.
    expect(arrangeableSections(song).every((sec) => sec.hasContent)).toBe(true);
    expect(song.lyrics[0]).not.toBe("");
    expect(song.lyrics[song.lyrics.length - 1]).not.toBe("");
    expect(song.lyrics.some((l, i) => l === "" && song.lyrics[i + 1] === "")).toBe(false);
  });
});

describe("arrangement list ops", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T10:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("createArrangement slugs the name, dedupes ids, and defaults steps to song order", () => {
    const a = createArrangement(WELL, "  Double Chorus!  ");
    expect(a).toEqual({
      id: "double-chorus",
      name: "Double Chorus!",
      steps: defaultSteps(WELL),
      createdAt: "2026-09-24T10:00:00.000Z",
      updatedAt: "2026-09-24T10:00:00.000Z",
    });
    const withOne = withArrangement(WELL, a);
    expect(createArrangement(withOne, "Double chorus").id).toBe("double-chorus-2");
  });

  it("createArrangement names a blank name and takes given steps", () => {
    const a = createArrangement(WELL, "   ", [step("[Chorus]")]);
    expect(a.name).toBe("Arrangement");
    expect(a.id).toBe("arrangement");
    expect(a.steps).toEqual([step("[Chorus]")]);
  });

  it("withArrangement inserts a new id and replaces an existing one, stamping updatedAt", () => {
    const first = arr([step("[Verse 1]")], "first");
    const second = arr([step("[Chorus]")], "second");
    let s = withArrangement(withArrangement(WELL, first), second);
    expect(s.arrangements!.map((a) => a.id)).toEqual(["first", "second"]);
    expect(s.arrangements![0].updatedAt).toBe("2026-09-24T10:00:00.000Z");

    s = withArrangement(s, { ...first, name: "Renamed", steps: [] });
    expect(s.arrangements!.map((a) => [a.id, a.name])).toEqual([
      ["first", "Renamed"],
      ["second", "second"],
    ]);
    expect(s.arrangements![0].createdAt).toBe("2026-01-01");
    expect(WELL.arrangements).toBeUndefined();
  });

  it("withoutArrangement removes by id and leaves arrangements undefined when empty", () => {
    const s = withArrangement(withArrangement(WELL, arr([], "a")), arr([], "b"));
    const one = withoutArrangement(s, "a");
    expect(one.arrangements!.map((a) => a.id)).toEqual(["b"]);
    expect(withoutArrangement(one, "b").arrangements).toBeUndefined();
    expect(withoutArrangement(WELL, "nope").arrangements).toBeUndefined();
    expect(withoutArrangement(one, "nope").arrangements!.map((a) => a.id)).toEqual(["b"]);
  });
});

describe("step list ops", () => {
  const a = step("[Verse 1]");
  const b = step("[Chorus]");
  const c = step("[Verse 2]");
  const steps = [a, b, c];

  it.each<[number, number, ArrangementStep[]]>([
    [0, 1, [b, a, c]],
    [2, -1, [a, c, b]],
    [0, 2, [b, c, a]],
    [0, -1, steps],
    [2, 1, steps],
    [-1, 1, steps],
    [3, -1, steps],
  ])("moveStep(%i, %i)", (index, delta, expected) => {
    expect(moveStep(steps, index, delta)).toEqual(expected);
  });

  it("moveStep returns the same array when out of bounds", () => {
    expect(moveStep(steps, 0, -1)).toBe(steps);
  });

  it.each<[number, ArrangementStep[]]>([
    [0, [a, a, b, c]],
    [1, [a, b, b, c]],
    [2, [a, b, c, c]],
    [-1, steps],
    [3, steps],
  ])("duplicateStep(%i)", (index, expected) => {
    expect(duplicateStep(steps, index)).toEqual(expected);
  });

  it("duplicateStep copies the step object rather than sharing it", () => {
    const out = duplicateStep(steps, 1);
    expect(out[2]).not.toBe(out[1]);
  });

  it.each<[number, ArrangementStep[]]>([
    [0, [b, c]],
    [2, [a, b]],
    [-1, steps],
    [3, steps],
  ])("removeStep(%i)", (index, expected) => {
    expect(removeStep(steps, index)).toEqual(expected);
  });

  it.each<[string, ArrangementStep, Partial<ArrangementStep>, ArrangementStep]>([
    ["sets a repeat", b, { repeat: 3 }, { ...b, repeat: 3 }],
    ["deletes repeat 1", { ...b, repeat: 3 }, { repeat: 1 }, b],
    ["clamps repeat 0 up to 1, deleting it", { ...b, repeat: 3 }, { repeat: 0 }, b],
    ["clamps a negative repeat up to 1", b, { repeat: -4 }, b],
    ["clamps repeat down to the max", b, { repeat: 99 }, { ...b, repeat: MAX_REPEAT }],
    ["keeps the max", b, { repeat: 16 }, { ...b, repeat: 16 }],
    ["rounds a fractional repeat", b, { repeat: 2.6 }, { ...b, repeat: 3 }],
    ["drops a NaN repeat", { ...b, repeat: 2 }, { repeat: NaN }, b],
    ["clears repeat when patched undefined", { ...b, repeat: 2 }, { repeat: undefined }, b],
    ["keeps an existing repeat untouched by other patches", { ...b, repeat: 4 }, { note: "x" }, { ...b, repeat: 4, note: "x" }],
    ["sets a note", b, { note: "vamp" }, { ...b, note: "vamp" }],
    ["deletes a blank note", { ...b, note: "vamp" }, { note: "  " }, b],
    ["deletes an empty note", { ...b, note: "vamp" }, { note: "" }, b],
    ["sets a mark", b, { mark: { kind: "full" } }, { ...b, mark: { kind: "full" } }],
    ["sets a null mark", b, { mark: null }, { ...b, mark: null }],
  ])("updateStep %s", (_name, start, patch, expected) => {
    expect(updateStep([a, start, c], 1, patch)).toEqual([a, expected, c]);
  });

  it("updateStep ignores out of range indices", () => {
    expect(updateStep(steps, -1, { repeat: 2 })).toBe(steps);
    expect(updateStep(steps, 3, { repeat: 2 })).toBe(steps);
  });

  it("updateStep leaves the other steps as the same objects", () => {
    const out = updateStep(steps, 1, { repeat: 2 });
    expect(out[0]).toBe(a);
    expect(out[2]).toBe(c);
    expect(steps[1]).toEqual(step("[Chorus]"));
  });
});

describe("out steps", () => {
  it("anchors each out step to its rendered label and occurrence", () => {
    const { song } = renderArrangement(
      WELL,
      arr([step("[Verse 1]", 1, { out: true }), step("[Chorus]"), step("[Chorus]", 1, { out: true })]),
    );
    expect(song.outSections).toEqual([
      { section: "[Verse 1]", occurrence: 1 },
      { section: "[Chorus]", occurrence: 2 },
    ]);
    const labels = sectionRanges(song.lyrics).map((r) => [r.label, r.occurrence]);
    expect(labels).toContainEqual(["[Chorus]", 2]);
  });

  it("leaves outSections undefined when no step is out", () => {
    expect(renderArrangement(WELL, arr(defaultSteps(WELL))).song.outSections).toBeUndefined();
  });

  it("labels an unlabeled opening so an out can anchor to it", () => {
    const song = mk([AG, "", "[Verse 1]", V1A]);
    const { song: out } = renderArrangement(song, arr([step(OPENING, 1, { out: true }), step("[Verse 1]")]));
    expect(out.lyrics[0]).toBe("[Opening]");
    expect(out.outSections).toEqual([{ section: "[Opening]", occurrence: 1 }]);
  });

  it("updateStep sets out and drops it again when cleared", () => {
    const steps = [step("[Chorus]")];
    const on = updateStep(steps, 0, { out: true });
    expect(on[0]).toEqual({ section: "[Chorus]", occurrence: 1, out: true });
    expect(updateStep(on, 0, { out: false })[0]).toEqual({ section: "[Chorus]", occurrence: 1 });
  });
});
