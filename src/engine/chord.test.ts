import { describe, expect, it } from "vitest";
import { chordFamily, formatChord, isChordSymbol, parseChord } from "./chord";

describe("parseChord", () => {
  const cases: Array<[string, { rootPc: number; quality: string; bassPc?: number }]> = [
    ["C", { rootPc: 0, quality: "" }],
    ["Am", { rootPc: 9, quality: "m" }],
    ["Am7", { rootPc: 9, quality: "m7" }],
    ["G7", { rootPc: 7, quality: "7" }],
    ["Bbmaj7", { rootPc: 10, quality: "maj7" }],
    ["F#m", { rootPc: 6, quality: "m" }],
    ["F#m7b5", { rootPc: 6, quality: "m7b5" }],
    ["Cdim", { rootPc: 0, quality: "dim" }],
    ["Cdim7", { rootPc: 0, quality: "dim7" }],
    ["Eaug", { rootPc: 4, quality: "aug" }],
    ["Dsus2", { rootPc: 2, quality: "sus2" }],
    ["Dsus4", { rootPc: 2, quality: "sus4" }],
    ["A7sus4", { rootPc: 9, quality: "7sus4" }],
    ["C6", { rootPc: 0, quality: "6" }],
    ["Am6", { rootPc: 9, quality: "m6" }],
    ["C9", { rootPc: 0, quality: "9" }],
    ["Em9", { rootPc: 4, quality: "m9" }],
    ["Cadd9", { rootPc: 0, quality: "add9" }],
    ["C11", { rootPc: 0, quality: "11" }],
    ["C13", { rootPc: 0, quality: "13" }],
    ["A5", { rootPc: 9, quality: "5" }],
    ["G/B", { rootPc: 7, quality: "", bassPc: 11 }],
    ["Am7/G", { rootPc: 9, quality: "m7", bassPc: 7 }],
    ["Eb/Bb", { rootPc: 3, quality: "", bassPc: 10 }],
  ];
  it.each(cases)("parses %s", (symbol, expected) => {
    const parsed = parseChord(symbol);
    expect(parsed).not.toBeNull();
    expect(parsed!.rootPc).toBe(expected.rootPc);
    expect(parsed!.quality).toBe(expected.quality);
    expect(parsed!.bassPc).toBe(expected.bassPc);
  });

  const aliases: Array<[string, string]> = [
    ["CM7", "maj7"],
    ["CMaj7", "maj7"],
    ["Cmin", "m"],
    ["Cmin7", "m7"],
    ["C-", "m"],
    ["C-7", "m7"],
    ["C+", "aug"],
    ["Co", "dim"],
    ["Co7", "dim7"],
    ["Dsus", "sus4"],
  ];
  it.each(aliases)("normalizes %s to quality %s", (symbol, quality) => {
    expect(parseChord(symbol)?.quality).toBe(quality);
  });

  it("preserves unknown but plausible qualities verbatim", () => {
    expect(parseChord("Cmaj9")?.quality).toBe("maj9");
    expect(parseChord("G7b9")?.quality).toBe("7b9");
    expect(parseChord("Dm7add11")?.quality).toBe("m7add11");
  });

  const invalid = ["H", "Cx", "", "  ", "c", "C##", "G/H", "hello", "1", "/"];
  it.each(invalid)("rejects %s", (symbol) => {
    expect(parseChord(symbol)).toBeNull();
    expect(isChordSymbol(symbol)).toBe(false);
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseChord(" Am7 ")?.quality).toBe("m7");
  });
});

describe("formatChord", () => {
  it("spells by preference and appends bass", () => {
    expect(formatChord(10, "maj7", undefined, "flat")).toBe("Bbmaj7");
    expect(formatChord(10, "maj7", undefined, "sharp")).toBe("A#maj7");
    expect(formatChord(7, "", 11, "sharp")).toBe("G/B");
  });
});

describe("chordFamily", () => {
  const cases: Array<[string, string]> = [
    ["", "major"], ["maj7", "major"], ["6", "major"], ["add9", "major"],
    ["sus2", "major"], ["sus4", "major"], ["5", "major"], ["aug", "major"],
    ["m", "minor"], ["m7", "minor"], ["m6", "minor"], ["m9", "minor"],
    ["7", "dominant"], ["9", "dominant"], ["11", "dominant"], ["13", "dominant"], ["7sus4", "dominant"],
    ["dim", "diminished"], ["dim7", "diminished"], ["m7b5", "diminished"],
  ];
  it.each(cases)("classifies %s as %s", (quality, family) => {
    expect(chordFamily(quality)).toBe(family);
  });
});
