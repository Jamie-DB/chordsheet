import { describe, expect, it } from "vitest";
import {
  detectBpm,
  isChordLine,
  parseChordNotationLine,
  parsePastedTab,
  repairChordTextLines,
} from "./tabPaste";

describe("isChordLine", () => {
  it("accepts rows of chord symbols", () => {
    expect(isChordLine("G       C     G")).toBe(true);
    expect(isChordLine("Am7 G/B  F#m7b5")).toBe(true);
    expect(isChordLine("  D")).toBe(true);
  });
  it("rejects lyric lines and section headers", () => {
    expect(isChordLine("Amazing grace, how sweet the sound")).toBe(false);
    expect(isChordLine("[Verse 1]")).toBe(false);
    expect(isChordLine("A wretch like me")).toBe(false);
    expect(isChordLine("")).toBe(false);
  });
  it("accepts bar and rhythm notation", () => {
    expect(isChordLine("|C / / /|Csus / / /|C / / /|Csus / / /|")).toBe(true);
    expect(isChordLine("       F/A             C         |C / F/A / |C / F/A /|")).toBe(true);
    expect(isChordLine("G - - - Am (x2)")).toBe(true);
    expect(isChordLine("| / / / |")).toBe(false);
    expect(isChordLine("C / word")).toBe(false);
  });
});

describe("parseChordNotationLine", () => {
  it("keeps chord columns exact through pipe blanking", () => {
    const line = "|C / / /|Csus / / /|";
    const notation = parseChordNotationLine(line)!;
    expect(notation.chords.map((t) => `${t.text}@${t.col}`)).toEqual(["C@1", "Csus@9"]);
    expect(notation.hasRhythm).toBe(true);
  });
});

describe("parsePastedTab", () => {
  const tab = [
    "[Verse 1]",
    "G                  C         G",
    "Amazing grace, how sweet the sound",
    "                         D",
    "That saved a wretch like me",
    "",
    "[Instrumental]",
    "G   C   G   D",
    "",
    "G",
    "I once was lost",
  ].join("\n");

  it("converts chord rows into placements on the following lyric line", () => {
    const parsed = parsePastedTab(tab);
    expect(parsed.lyrics).toEqual([
      "[Verse 1]",
      "Amazing grace, how sweet the sound",
      "That saved a wretch like me",
      "",
      "[Instrumental]",
      "",
      "",
      "I once was lost",
    ]);
    expect(parsed.chordLinesConverted).toBe(4);

    const on = (line: number) =>
      parsed.placements
        .filter((p) => p.line === line)
        .sort((a, b) => a.col - b.col)
        .map((p) => `${p.chord}@${p.col}`);
    expect(on(1)).toEqual(["G@0", "C@19", "G@29"]);
    expect(on(2)).toEqual(["D@25"]);
    expect(on(5)).toEqual(["G@0", "C@4", "G@8", "D@12"]);
    expect(on(7)).toEqual(["G@0"]);
  });

  it("keeps a chord-free paste unchanged", () => {
    const parsed = parsePastedTab("Just words here\nAnd more words");
    expect(parsed.lyrics).toEqual(["Just words here", "And more words"]);
    expect(parsed.placements).toEqual([]);
    expect(parsed.chordLinesConverted).toBe(0);
  });

  it("handles a chord row at end of input as standalone", () => {
    const parsed = parsePastedTab("Some words\nG C D");
    expect(parsed.lyrics).toEqual(["Some words", ""]);
    expect(parsed.placements.map((p) => p.line)).toEqual([1, 1, 1]);
  });

  it("keeps a chord row standalone when a section label follows", () => {
    const parsed = parsePastedTab("G C D\n[Chorus]\nSing the words");
    expect(parsed.lyrics).toEqual(["", "[Chorus]", "Sing the words"]);
    expect(parsed.placements.every((p) => p.line === 0)).toBe(true);
  });

  it("transposes shapes to sounding when written for a capo", () => {
    const parsed = parsePastedTab("C        Am\nHello my friend", 4);
    expect(parsed.placements.map((p) => p.chord)).toEqual(["E", "C#m"]);
    expect(parsed.placements.map((p) => p.col)).toEqual([0, 9]);
  });

  it("expands tabs before measuring columns", () => {
    const parsed = parsePastedTab("\tG\nHello world friends");
    expect(parsed.placements[0].col).toBe(4);
  });

  it("drops page artifacts before pairing chord rows", () => {
    const parsed = parsePastedTab("G   C\nPage 1/3\nHello there my friend");
    expect(parsed.lyrics).toEqual(["Hello there my friend"]);
    expect(parsed.placements.map((p) => `${p.chord}@${p.line}:${p.col}`)).toEqual(["G@0:0", "C@0:4"]);
  });

  it("promotes inline label notes at paste time", () => {
    const parsed = parsePastedTab("[Verse] *soft piano*\nG   C\nHello there my friend");
    expect(parsed.lyrics[0]).toBe("[Verse]");
    expect(parsed.sectionMarks).toEqual([
      { section: "[Verse]", occurrence: 1, kind: "soft", text: "soft piano" },
    ]);
  });

  it("carries a detected tempo", () => {
    expect(parsePastedTab("Tempo: 120\nG\nHello there friend").bpm).toBe(120);
    expect(parsePastedTab("G\nHello there friend").bpm).toBeNull();
  });
});

describe("repairChordTextLines", () => {
  const p = (line: number, col: number, chord: string) => ({ id: `${line}-${col}`, line, col, chord });

  it("attaches a missed chord row to the chord-free lyric below and deletes the row", () => {
    const result = repairChordTextLines(
      ["       F/A             C         |C / F/A /|", "Of Your kingdom breaking through"],
      [],
    );
    expect(result.lyrics).toEqual(["Of Your kingdom breaking through"]);
    expect(result.placements.map((x) => `${x.chord}@${x.line}:${x.col}`)).toEqual([
      "F/A@0:7",
      "C@0:23",
      "C@0:34",
      "F/A@0:38",
    ]);
    expect(result.converted).toBe(1);
  });

  it("converts standalone bar rows in place over blanked lines", () => {
    const result = repairChordTextLines(["[Intro]", "|C / / /|Csus / / /|", ""], []);
    expect(result.lyrics).toEqual(["[Intro]", "", ""]);
    expect(result.placements.map((x) => `${x.chord}@${x.line}:${x.col}`)).toEqual(["C@1:1", "Csus@1:9"]);
  });

  it("leaves the row standalone when the lyric below already has chords", () => {
    const result = repairChordTextLines(
      ["C   G", "Words with chords"],
      [p(1, 0, "Am")],
    );
    expect(result.lyrics).toEqual(["", "Words with chords"]);
    expect(result.placements.filter((x) => x.line === 0).map((x) => x.chord)).toEqual(["C", "G"]);
    expect(result.placements.filter((x) => x.line === 1).map((x) => x.chord)).toEqual(["Am"]);
  });

  it("never converts a single bare note-word line", () => {
    const result = repairChordTextLines(["A", "wretch like me"], []);
    expect(result.changed).toBe(false);
    expect(result.lyrics).toEqual(["A", "wretch like me"]);
  });

  it("never attaches a chord row to a section label", () => {
    const result = repairChordTextLines(["|D / F#m7 /|", "[Verse 1]", "The words begin"], []);
    expect(result.lyrics).toEqual(["", "[Verse 1]", "The words begin"]);
    expect(result.placements.every((x) => x.line === 0)).toBe(true);
  });

  it("skips rows that already carry placements and remaps others", () => {
    const result = repairChordTextLines(
      ["C G Am", "Some words here", "|D / /|", "More words here"],
      [p(0, 0, "C"), p(3, 2, "G")],
    );
    expect(result.lyrics).toEqual(["C G Am", "Some words here", "", "More words here"]);
    expect(result.placements.find((x) => x.id === "3-2")!.line).toBe(3);
    expect(result.placements.filter((x) => x.chord === "D").map((x) => x.line)).toEqual([2]);
  });

  it("uses deterministic ids", () => {
    const a = repairChordTextLines(["|C / G /|", ""], []);
    const b = repairChordTextLines(["|C / G /|", ""], []);
    expect(a.placements.map((x) => x.id)).toEqual(b.placements.map((x) => x.id));
  });
});

describe("detectBpm", () => {
  it("reads common tempo declarations", () => {
    expect(detectBpm(["Tempo: 120"])).toBe(120);
    expect(detectBpm(["tempo = 96"])).toBe(96);
    expect(detectBpm(["Capo 4, 72 BPM"])).toBe(72);
    expect(detectBpm(["140bpm"])).toBe(140);
  });
  it("ignores implausible or absent tempos", () => {
    expect(detectBpm(["Tempo: 999"])).toBeNull();
    expect(detectBpm(["no tempo here"])).toBeNull();
    expect(detectBpm([])).toBeNull();
  });
});
