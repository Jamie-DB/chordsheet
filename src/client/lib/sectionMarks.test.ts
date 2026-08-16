import { describe, expect, it } from "vitest";
import type { SectionMark } from "../../shared/types";
import { markColor, markFor, markName, sectionRanges, withMark, withoutMark } from "./sectionMarks";

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

  it("replaces and clears without touching other sections", () => {
    const soft: SectionMark = { section: "[Chorus]", occurrence: 2, kind: "soft" };
    const next = withMark([tacet, custom], soft);
    expect(markFor(next, "[Chorus]", 2)).toBe(soft);
    expect(next).toHaveLength(2);
    expect(withoutMark(next, "[Chorus]", 2)).toEqual([custom]);
  });
});
