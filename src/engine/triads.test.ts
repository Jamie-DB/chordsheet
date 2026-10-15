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
    ["5", "5"],
  ])("reduces %j to the %j triad", (quality, suffix) => {
    expect(triadOf(quality).suffix).toBe(suffix);
  });
});

describe("triadHome", () => {
  it.each([
    ["E", 1 / 3], // G-B-E 1-0-0
    ["C", 1 / 3], // G-B-E 0-1-0
    ["Am", 1], // G-B-E 2-1-0
    ["not a key", 0],
  ])("puts %s at fret %d", (key, fret) => {
    expect(triadHome(key)).toBeCloseTo(fret);
  });
});

describe("triadVoicingFor", () => {
  it.each([
    ["E", [X, X, X, 1, 0, 0], "E", false],
    ["C#m7", [X, X, X, 1, 2, 0], "C#m", true],
    ["B", [X, X, X, 4, 4, 2], "B", false],
    ["G/B", [X, X, 0, 0, 0, X], "G", true],
  ] as const)("voices %s near the key of E", (symbol, frets, playedAs, approximated) => {
    const result = triadVoicingFor(symbol, triadHome("E"))!;
    expect(result.voicing.frets).toEqual(frets);
    expect(result.playedAs).toBe(playedAs);
    expect(result.approximated).toBe(approximated);
  });

  it("moves up the neck with a higher home", () => {
    const low = triadVoicingFor("C", 0)!.voicing.frets;
    const high = triadVoicingFor("C", 8)!.voicing.frets;
    expect(Math.max(...high)).toBeGreaterThan(Math.max(...low));
  });

  it("keeps the root as written", () => {
    expect(triadVoicingFor("Dbmaj7", 0)!.playedAs).toBe("Db");
  });

  it("returns null for symbols that do not parse", () => {
    expect(triadVoicingFor("N.C.", 0)).toBeNull();
  });

  const suffixes = ["", "m", "dim", "aug", "sus2", "sus4", "5"];
  const roots = Array.from({ length: 12 }, (_, pc) => pcToName(pc, "flat"));
  it.each(roots.flatMap((root) => suffixes.map((suffix) => `${root}${suffix}`)))(
    "plays exactly the triad tones of %s on three adjacent top strings",
    (symbol) => {
      for (const home of [0, 5, 10]) {
        const { frets } = triadVoicingFor(symbol, home)!.voicing;
        const played = frets.flatMap((f, s) => (f >= 0 ? [s] : []));
        expect(played).toHaveLength(3);
        expect(played[0]).toBeGreaterThanOrEqual(2);
        expect(played[2] - played[0]).toBe(2);
        const fretted = played.map((s) => frets[s]);
        expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3);
        const { intervals } = triadOf(symbol.replace(/^[A-G]b?/, ""));
        const rootPc = roots.indexOf(symbol.match(/^[A-G]b?/)![0]);
        const tones = new Set(intervals.map((i) => mod12(rootPc + i)));
        expect(new Set(played.map((s) => mod12(OPEN_PCS[s] + frets[s])))).toEqual(tones);
      }
    },
  );
});
