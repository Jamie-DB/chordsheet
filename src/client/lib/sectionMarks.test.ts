import { describe, expect, it } from "vitest";
import type { SectionMark } from "../../shared/types";
import {
  extractLabelNotes,
  inferKind,
  markFor,
  markName,
  outStyling,
  sectionRanges,
  sectionStyling,
  sectionType,
  withMark,
  withoutMark,
} from "./sectionMarks";

describe("sectionRanges", () => {
  it("splits at labels, handling duplicates and unlabeled leading lines", () => {
    const lyrics = ["intro words", "[Verse]", "a", "b", "", "[Chorus]", "c", "[Chorus]", "d", "e"];
    expect(sectionRanges(lyrics)).toEqual([
      { label: "[Verse]", occurrence: 1, start: 1, end: 4 },
      { label: "[Chorus]", occurrence: 1, start: 5, end: 6 },
      { label: "[Chorus]", occurrence: 2, start: 7, end: 9 },
    ]);
  });
  it("returns nothing for unlabeled songs", () => {
    expect(sectionRanges(["just", "words"])).toEqual([]);
  });
});

describe("sectionStyling", () => {
  const lyrics = [
    "[Verse]",
    "Amazing grace, how sweet the sound",
    "",
    "[Chorus]",
    "That saved a wretch like me",
    "[Chorus]",
    "I once was lost, but now am found",
  ];

  it("types every line of a section by its label and flags tacet lines", () => {
    const marks: SectionMark[] = [
      { section: "[Verse]", occurrence: 1, kind: "soft" },
      { section: "[Chorus]", occurrence: 2, kind: "tacet" },
    ];
    const { typeByLine, tacetLines } = sectionStyling(lyrics, marks);
    expect([...typeByLine.entries()]).toEqual([
      [0, "verse"],
      [1, "verse"],
      [2, "verse"],
      [3, "chorus"],
      [4, "chorus"],
      [5, "chorus"],
      [6, "chorus"],
    ]);
    expect([...tacetLines]).toEqual([5, 6]);
  });

  it("types sections the same with or without marks", () => {
    const { typeByLine, tacetLines } = sectionStyling(lyrics, []);
    expect(typeByLine.get(1)).toBe("verse");
    expect(typeByLine.get(4)).toBe("chorus");
    expect(tacetLines.size).toBe(0);
  });

  it("leaves unlabeled lines untyped", () => {
    const { typeByLine } = sectionStyling(["Amazing grace", "[Verse]", "How sweet"], []);
    expect([...typeByLine.keys()]).toEqual([1, 2]);
  });
});

describe("sectionType", () => {
  it.each([
    ["[Intro]", "intro"],
    ["[Verse 1]", "verse"],
    ["[verse]", "verse"],
    ["[Pre-Chorus]", "prechorus"],
    ["[Prechorus 2]", "prechorus"],
    ["[Pre Chorus]", "prechorus"],
    ["[Chorus]", "chorus"],
    ["[Final Chorus]", "chorus"],
    ["[Refrain]", "chorus"],
    ["[Hook]", "chorus"],
    ["[Post-Chorus]", "tag"],
    ["[Tag]", "tag"],
    ["[Tagline]", "tag"],
    ["[Vamp]", "tag"],
    ["[Bridge]", "bridge"],
    ["[Bridge 2]", "bridge"],
    ["[Outro]", "outro"],
    ["[Ending]", "outro"],
    ["[Coda]", "outro"],
    ["[Instrumental]", "instrumental"],
    ["[Interlude]", "instrumental"],
    ["[Guitar Solo]", "instrumental"],
    ["[Turnaround]", "instrumental"],
    ["[Break]", "instrumental"],
    ["[Spoken]", "other"],
    ["[Vintage]", "other"],
  ])("%s is %s", (label, type) => {
    expect(sectionType(label)).toBe(type);
  });
});

describe("marks", () => {
  const tacet: SectionMark = { section: "[Chorus]", occurrence: 2, kind: "tacet" };
  const custom: SectionMark = { section: "[Bridge]", occurrence: 1, kind: "custom", text: "swell", color: "amber" };

  it("resolves by label and occurrence", () => {
    expect(markFor([tacet, custom], "[Chorus]", 2)).toBe(tacet);
    expect(markFor([tacet], "[Chorus]", 1)).toBeNull();
    expect(markFor([tacet], "[Verse]", 2)).toBeNull();
  });

  it("names presets and customs", () => {
    expect(markName(tacet)).toBe("Tacet");
    expect(markName(custom)).toBe("swell");
    expect(markName({ ...custom, text: "  " })).toBe("Custom");
  });

  it("a note overrides any preset's term", () => {
    const noted: SectionMark = { ...tacet, text: "Hard cut - Absolute Quiet" };
    expect(markName(noted)).toBe("Hard cut - Absolute Quiet");
  });

  it("infers presets from note keywords, custom amber otherwise", () => {
    expect(inferKind("Very soft dynamics - piano only").kind).toBe("soft");
    expect(inferKind("Band in softly, cymbal swells").kind).toBe("soft");
    expect(inferKind("Big swell into last chorus").kind).toBe("build");
    expect(inferKind("TACET until drop").kind).toBe("tacet");
    expect(inferKind("Full band, loud").kind).toBe("full");
    expect(inferKind("Dropdown, 2 bar vamp")).toEqual({ kind: "custom", color: "amber" });
  });

  it("replaces and clears without touching other sections", () => {
    const soft: SectionMark = { section: "[Chorus]", occurrence: 2, kind: "soft" };
    const next = withMark([tacet, custom], soft);
    expect(markFor(next, "[Chorus]", 2)).toBe(soft);
    expect(next).toHaveLength(2);
    expect(withoutMark(next, "[Chorus]", 2)).toEqual([custom]);
  });
});

describe("extractLabelNotes", () => {
  it("promotes asterisk notes into marks and bares the label", () => {
    const result = extractLabelNotes(
      ["[Verse 1] *Very soft dynamics - piano only*", "words here", "[Vamp] *Dropdown, 2 bar vamp*"],
      [],
    );
    expect(result.lyrics).toEqual(["[Verse 1]", "words here", "[Vamp]"]);
    expect(result.converted).toBe(2);
    const verse = markFor(result.sectionMarks, "[Verse 1]", 1)!;
    expect(verse.kind).toBe("soft");
    expect(verse.text).toBe("Very soft dynamics - piano only");
    const vamp = markFor(result.sectionMarks, "[Vamp]", 1)!;
    expect(vamp.kind).toBe("custom");
    expect(vamp.color).toBe("amber");
  });

  it("computes occurrences against the rewritten lyrics", () => {
    const result = extractLabelNotes(
      ["[Chorus]", "one", "[Chorus] *soft second time*", "two"],
      [],
    );
    expect(result.lyrics[2]).toBe("[Chorus]");
    expect(markFor(result.sectionMarks, "[Chorus]", 2)?.text).toBe("soft second time");
    expect(markFor(result.sectionMarks, "[Chorus]", 1)).toBeNull();
  });

  it("never clobbers an existing mark", () => {
    const existing: SectionMark = { section: "[Verse]", occurrence: 1, kind: "full" };
    const result = extractLabelNotes(["[Verse] *quiet*", "la"], [existing]);
    expect(result.lyrics[0]).toBe("[Verse]");
    expect(result.converted).toBe(0);
    expect(markFor(result.sectionMarks, "[Verse]", 1)).toBe(existing);
  });

  it("leaves plain labels and lyric lines alone", () => {
    const result = extractLabelNotes(["[Verse]", "Just words [not a label]", "so [brackets] here"], []);
    expect(result.changed).toBe(false);
    expect(result.lyrics).toEqual(["[Verse]", "Just words [not a label]", "so [brackets] here"]);
  });
});

describe("outStyling", () => {
  const lyrics = ["[Intro]", "a", "", "[Verse 1]", "b", "c", "", "[Chorus]", "d", "", "[Verse 2]", "e", ""];
  const ref = (section: string, occurrence = 1) => ({ section, occurrence });

  it("joins back-to-back out sections into one run and trims trailing blanks", () => {
    const out = outStyling(lyrics, [ref("[Intro]"), ref("[Verse 1]")], new Set());
    expect([...out.lines]).toEqual([0, 1, 2, 3, 4, 5]);
    expect([...out.starts]).toEqual([0]);
    expect([...out.ends]).toEqual([5]);
  });

  it("splits runs at a section the player plays", () => {
    const out = outStyling(lyrics, [ref("[Intro]"), ref("[Chorus]")], new Set());
    expect([...out.starts]).toEqual([0, 7]);
    expect([...out.ends]).toEqual([1, 8]);
  });

  it("keeps a trailing chord-only line in the run", () => {
    const out = outStyling(lyrics, [ref("[Verse 2]")], new Set([12]));
    expect([...out.ends]).toEqual([12]);
  });

  it("is empty with no outs", () => {
    const out = outStyling(lyrics, [], new Set());
    expect(out.lines.size + out.starts.size + out.ends.size).toBe(0);
  });
});
