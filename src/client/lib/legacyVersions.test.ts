import { describe, expect, it } from "vitest";
import type { ChordPlacement, SectionMark, Song } from "../../shared/types";
import { OPENING, arrangeableSections } from "./arrangement";
import { chartOf } from "./charts";
import { upgradeVersions, type LegacyArrangement, type LegacyStep as ArrangementStep } from "./legacyVersions";
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

function arr(steps: ArrangementStep[], id = "a"): LegacyArrangement {
  return { id, name: id, steps, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
}

/** Every section once, in song order. */
const defaultSteps = (song: Song): ArrangementStep[] =>
  arrangeableSections(song).map((s) => ({ section: s.section, occurrence: s.occurrence }));

/** The chart an old version becomes. */
function renderArrangement(song: Song, version: LegacyArrangement): { song: Song } {
  const upgraded = upgradeVersions({ ...song, arrangements: [version] });
  return { song: chartOf(upgraded, version.id) };
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

describe("upgradeVersions renders an old version as its own chart", () => {
  it("renders the default arrangement with one blank between steps and none at the ends", () => {
    const { song } = renderArrangement(WELL, arr(defaultSteps(WELL)));
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

  it("renders an empty song for an empty or all-missing arrangement", () => {
    expect(renderArrangement(WELL, arr([])).song.lyrics).toEqual([]);
    const all = renderArrangement(WELL, arr([step("[Bridge]")])).song;
    expect(all.lyrics).toEqual([]);
    expect(all.placements).toEqual([]);
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
      const { song } = renderArrangement(opened, arr([step("[Bridge]"), step(OPENING), step("[Verse 1]")]));
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
    const source = { ...WELL, capo: 3, keyOverride: "Eb", arrangements: [arr(defaultSteps(WELL), "x")] } as Parameters<typeof upgradeVersions>[0];
    const upgraded = upgradeVersions(source);
    const { song } = { song: chartOf(upgraded, "x") };
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
    const { song } = renderArrangement(s, arr(steps));

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

});


describe("hold steps", () => {
  it("marks every chord in a hold step as a hold and leaves other steps alone", () => {
    const { song } = renderArrangement(WELL, arr([step("[Verse 1]"), step("[Chorus]", 1, { hold: true })]));
    const byLine = song.placements.map((p) => [p.chord, p.hold === true]);
    expect(byLine).toEqual([["D", false], ["A", false], ["D", true], ["A", true]]);
  });

  it("keeps the song as written untouched", () => {
    renderArrangement(WELL, arr([step("[Chorus]", 1, { hold: true })]));
    expect(WELL.placements.every((p) => p.hold === undefined)).toBe(true);
  });

  it("keeps a chord already held in the song held in a plain step", () => {
    const held = mk(["[Chorus]", CHA], [{ ...pc("c", 1, "D"), hold: true }]);
    expect(renderArrangement(held, arr([step("[Chorus]")])).song.placements[0].hold).toBe(true);
  });

});


describe("upgradeVersions", () => {
  const base = mk(
    ["[Verse 1]", V1A, "", "[Chorus]", CHA],
    [pc("a", 1, "D"), pc("b", 4, "A")],
    { keyOverride: "D", capo: 2, bpm: 90, notes: "Drop D" },
  );
  const old = arr([step("[Chorus]"), step("[Verse 1]")], "short");

  it("gives each old version its own chart with the song's key, capo, tempo, and notes", () => {
    const up = upgradeVersions({ ...base, arrangements: [old] });
    const version = up.arrangements?.[0];
    expect(version).toMatchObject({
      id: "short",
      name: "short",
      lyrics: ["[Chorus]", CHA, "", "[Verse 1]", V1A],
      keyOverride: "D",
      capo: 2,
      bpm: 90,
      notes: "Drop D",
    });
    expect(version).not.toHaveProperty("steps");
  });

  it("leaves the song as written alone", () => {
    const up = upgradeVersions({ ...base, arrangements: [old] });
    expect(up.lyrics).toEqual(base.lyrics);
    expect(up.placements).toEqual(base.placements);
  });

  it("returns the same object when no version is in the old form", () => {
    expect(upgradeVersions(base)).toBe(base);
    const up = upgradeVersions({ ...base, arrangements: [old] });
    expect(upgradeVersions(up)).toBe(up);
  });

  it("keeps versions already in the new form and upgrades only the old ones", () => {
    const up = upgradeVersions({ ...base, arrangements: [old] });
    const mixed = upgradeVersions({ ...up, arrangements: [...(up.arrangements ?? []), old as never] });
    expect(mixed.arrangements).toHaveLength(2);
    expect(mixed.arrangements?.[0]).toBe(up.arrangements?.[0]);
  });
});
