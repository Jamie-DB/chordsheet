import { describe, expect, it } from "vitest";
import type { SectionMark } from "../../shared/types";
import {
  extractLabelNotes,
  inferKind,
  markColor,
  markFor,
  markName,
  sectionRanges,
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

describe("marks", () => {
  const tacet: SectionMark = { section: "[Chorus]", occurrence: 2, kind: "tacet" };
  const custom: SectionMark = { section: "[Bridge]", occurrence: 1, kind: "custom", text: "swell", color: "amber" };

  it("resolves by label and occurrence", () => {
    expect(markFor([tacet, custom], "[Chorus]", 2)).toBe(tacet);
    expect(markFor([tacet], "[Chorus]", 1)).toBeNull();
    expect(markFor([tacet], "[Verse]", 2)).toBeNull();
  });

  it("names and colors presets and customs", () => {
    expect(markName(tacet)).toBe("Tacet");
    expect(markColor(tacet)).toBe("red");
    expect(markName(custom)).toBe("swell");
    expect(markColor(custom)).toBe("amber");
    expect(markName({ ...custom, text: "  " })).toBe("Custom");
  });

  it("a note overrides any preset's term while keeping its color", () => {
    const noted: SectionMark = { ...tacet, text: "Hard cut - Absolute Quiet" };
    expect(markName(noted)).toBe("Hard cut - Absolute Quiet");
    expect(markColor(noted)).toBe("red");
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
