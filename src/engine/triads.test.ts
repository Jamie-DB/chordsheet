import { describe, expect, it } from "vitest";
import { mod12, pcToName } from "./notes";
import { triadHome, triadOf, triadVoicingFor } from "./triads";

const X = -1;
const OPEN_PCS = [4, 9, 2, 7, 11, 4];

describe("triadOf", () => {
  it.each([
    ["", ""],
    ["maj7", ""],
    ["7", ""],
    ["13", ""],
    ["6", ""],
    ["add9", ""],
    ["add4", ""],
    ["m", "m"],
    ["m7", "m"],
    ["m9", "m"],
    ["m6", "m"],
    ["madd9", "m"],
    ["dim", "dim"],
    ["dim7", "dim"],
    ["m7b5", "dim"],
    ["aug", "aug"],
    ["+7", "aug"],
    ["7(#9#5)", "aug"],
    ["2", "sus2"],
    ["sus2", "sus2"],
    ["sus4", "sus4"],
    ["7sus4", "sus4"],
    ["sus42", "sus4"],
    ["5", ""],
  ])("reduces %j to the %j triad", (quality, suffix) => {
    expect(triadOf(quality).suffix).toBe(suffix);
  });
});

describe("triadHome", () => {
  it.each([
    ["E", 9], // D-G-B 9-9-9
    ["C", 5], // D-G-B 5-5-5
    ["Am", 17 / 3], // D-G-B 7-5-5
    ["not a key", 6],
  ])("starts %s at fret %d", (key, fret) => {
    expect(triadHome(key)).toBeCloseTo(fret);
  });
});

describe("triadVoicingFor", () => {
  it.each([
    ["E", "E", [X, X, 9, 9, 9, X], "E", false, 9],
    ["C#m7", "E", [X, X, 6, 6, 5, X], "C#m", true, 5],
    ["B", "E", [X, X, 9, 8, 7, X], "B", false, 7],
    ["E5", "E", [X, X, 9, 9, 9, X], "E", true, 9],
    ["C", "C", [X, X, 5, 5, 5, X], "C", false, 5],
    ["G/B", "C", [X, X, 5, 4, 3, X], "G", true, 3],
  ] as const)("voices %s near the key of %s", (symbol, key, frets, playedAs, approximated, baseFret) => {
    const result = triadVoicingFor(symbol, triadHome(key))!;
    expect(result.voicing.frets).toEqual(frets);
    expect(result.voicing.baseFret).toBe(baseFret);
    expect(result.playedAs).toBe(playedAs);
    expect(result.approximated).toBe(approximated);
  });

  it("takes the shape nearest the place it is given", () => {
    expect(triadVoicingFor("B", 4)!.voicing.frets).toEqual([X, X, 4, 4, 4, X]);
    expect(triadVoicingFor("B", 8)!.voicing.frets).toEqual([X, X, 9, 8, 7, X]);
  });

  it("keeps the root as written", () => {
    expect(triadVoicingFor("Dbmaj7", 6)!.playedAs).toBe("Db");
  });

  it("returns null for symbols that do not parse", () => {
    expect(triadVoicingFor("N.C.", 6)).toBeNull();
  });

  const suffixes = ["", "m", "dim", "aug", "sus2", "sus4"];
  const roots = Array.from({ length: 12 }, (_, pc) => pcToName(pc, "flat"));
  it.each(roots.flatMap((root) => suffixes.map((suffix) => `${root}${suffix}`)))(
    "plays exactly the triad tones of %s on D-G-B between frets 3 and 9",
    (symbol) => {
      for (const near of [3, 6, 9]) {
        const { frets } = triadVoicingFor(symbol, near)!.voicing;
        expect(frets.map((f, s) => (f >= 0 ? s : -1)).filter((s) => s >= 0)).toEqual([2, 3, 4]);
        const fretted = [frets[2], frets[3], frets[4]];
        expect(Math.min(...fretted)).toBeGreaterThanOrEqual(3);
        expect(Math.max(...fretted)).toBeLessThanOrEqual(9);
        expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3);
        const { intervals } = triadOf(symbol.replace(/^[A-G]b?/, ""));
        const rootPc = roots.indexOf(symbol.match(/^[A-G]b?/)![0]);
        const tones = new Set(intervals.map((i) => mod12(rootPc + i)));
        expect(new Set([2, 3, 4].map((s) => mod12(OPEN_PCS[s] + frets[s])))).toEqual(tones);
      }
    },
  );
});
