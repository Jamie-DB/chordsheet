import { describe, expect, it } from "vitest";
import type { Chart, Riff } from "../../shared/types";
import {
  chordSymbols,
  cleanTab,
  cueText,
  delayTimes,
  isCue,
  nextRiffName,
  parseCue,
  parseRiffPaste,
  removeRiff,
  renameRiff,
  riffNameProblem,
  tabAsShape,
  tabFromShape,
} from "./riffs";

const A: Riff = { id: "a", name: "Riff A", tab: ["D|-0-2-4-|"] };
const B: Riff = { id: "b", name: "Turnaround", tab: ["G|-2-4-|"] };

function chart(over: Partial<Chart> = {}): Chart {
  return {
    lyrics: ["[Intro]", "Amazing grace, how sweet the sound"],
    placements: [
      { id: "1", line: 1, col: 0, chord: "G" },
      { id: "2", line: 1, col: 19, chord: "C" },
      { id: "3", line: 0, col: 10, chord: "Riff A x2" },
      { id: "4", line: 1, col: 36, chord: "Turnaround" },
    ],
    keyOverride: null,
    capo: 0,
    riffs: [A, B],
    ...over,
  };
}

describe("cues", () => {
  it("writes a repeat count only past one", () => {
    expect(cueText("Riff A")).toBe("Riff A");
    expect(cueText("Riff A", 3)).toBe("Riff A x3");
  });

  it.each([
    ["Riff A", "a", 1],
    ["riff a", "a", 1],
    ["Riff A x2", "a", 2],
    ["Riff A X4", "a", 4],
    ["  Turnaround  ", "b", 1],
  ])("reads %j as a cue", (text, id, times) => {
    expect(parseCue(text, [A, B])).toEqual({ riff: id === "a" ? A : B, times });
  });

  it.each(["G", "Riff C", "Riff", ""])("reads %j as not a cue", (text) => {
    expect(parseCue(text, [A, B])).toBeNull();
  });

  it("finds no cues in a chart without riffs", () => {
    expect(parseCue("Riff A", undefined)).toBeNull();
    expect(isCue({ id: "x", line: 0, col: 0, chord: "Riff A" }, [])).toBe(false);
  });

  it("leaves cues out of the chord symbols", () => {
    expect(chordSymbols(chart())).toEqual(["G", "C"]);
  });
});

describe("riff names", () => {
  it("takes the next free letter", () => {
    expect(nextRiffName(undefined)).toBe("Riff A");
    expect(nextRiffName([A])).toBe("Riff B");
    expect(nextRiffName([A, { ...B, name: "Riff B" }])).toBe("Riff C");
  });

  it.each([
    ["", "Give the riff a name."],
    ["Am7", '"Am7" reads as a chord. Try "Riff Am7".'],
    ["Hook x2", "A name cannot end in a repeat count like x2."],
    ["riff a", 'There is already a riff called "riff a".'],
  ])("rejects %j", (name, problem) => {
    expect(riffNameProblem(name, [A])).toBe(problem);
  });

  it("accepts a riff keeping its own name", () => {
    expect(riffNameProblem("Riff A", [A], "a")).toBeNull();
    expect(riffNameProblem("Intro hook", [A])).toBeNull();
  });

  it("renames every cue with the riff, keeping repeat counts", () => {
    const next = renameRiff(chart(), "a", "Intro hook");
    expect(next.riffs?.[0].name).toBe("Intro hook");
    expect(next.placements.map((p) => p.chord)).toEqual(["G", "C", "Intro hook x2", "Turnaround"]);
  });

  it("removes a riff with its cues", () => {
    const next = removeRiff(chart(), "a");
    expect(next.riffs).toEqual([B]);
    expect(next.placements.map((p) => p.chord)).toEqual(["G", "C", "Turnaround"]);
    expect(removeRiff(next, "b").riffs).toBeUndefined();
  });
});

describe("tab text", () => {
  it("cleans pasted tab", () => {
    expect(cleanTab("\n\ne|-0-\t|  \r\nB|-1-|\n\n")).toEqual(["e|-0-    |", "B|-1-|"]);
  });

  it("moves between sounding and shape frets under a capo", () => {
    const sounding = ["D|-2-4-6-|"];
    expect(tabAsShape(sounding, 2)).toEqual(["D|-0-2-4-|"]);
    expect(tabFromShape(["D|-0-2-4-|"], 2)).toEqual(sounding);
    expect(tabAsShape(sounding, 0)).toBe(sounding);
  });

  it("splits pasted riffs on their headings", () => {
    const text = [
      "Intro hook | Intro, Chorus | 0:12",
      "e|-----|",
      "B|-3---|",
      "",
      "e|-----|",
      "B|---5-|",
      "",
      "Turnaround:",
      "G|-2-4-|",
    ].join("\n");
    expect(parseRiffPaste(text)).toEqual([
      { name: "Intro hook", hint: "Intro, Chorus", ref: "0:12", tab: ["e|-----|", "B|-3---|", "", "e|-----|", "B|---5-|"] },
      { name: "Turnaround", tab: ["G|-2-4-|"] },
    ]);
  });

  it("returns an unnamed riff for a bare staff and nothing for plain text", () => {
    expect(parseRiffPaste("e|-0-|\nB|-1-|")).toEqual([{ name: "", tab: ["e|-0-|", "B|-1-|"] }]);
    expect(parseRiffPaste("just some words\nmore words")).toEqual([]);
  });
});

describe("delayTimes", () => {
  it.each([
    [72, 625, 833, 417],
    [120, 375, 500, 250],
    [60, 750, 1000, 500],
  ])("at %i BPM", (bpm, dottedEighth, quarter, eighth) => {
    expect(delayTimes(bpm)).toEqual({ dottedEighth, quarter, eighth });
  });
});
