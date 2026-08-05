import { describe, expect, it } from "vitest";
import { detectBpm, isChordLine, parsePastedTab } from "./tabPaste";

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

  it("transposes shapes to sounding when written for a capo", () => {
    const parsed = parsePastedTab("C        Am\nHello my friend", 4);
    expect(parsed.placements.map((p) => p.chord)).toEqual(["E", "C#m"]);
    expect(parsed.placements.map((p) => p.col)).toEqual([0, 9]);
  });

  it("expands tabs before measuring columns", () => {
    const parsed = parsePastedTab("\tG\nHello world friends");
    expect(parsed.placements[0].col).toBe(4);
  });

  it("carries a detected tempo", () => {
    expect(parsePastedTab("Tempo: 120\nG\nHello there friend").bpm).toBe(120);
    expect(parsePastedTab("G\nHello there friend").bpm).toBeNull();
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
