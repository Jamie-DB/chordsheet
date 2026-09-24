import { describe, expect, it } from "vitest";
import { displayChord, shapedKey, soundingFromShape, suggestCapo } from "./capo";

describe("shapedKey", () => {
  it("moves the key down by the capo", () => {
    expect(shapedKey("Eb", 3)).toBe("C");
    expect(shapedKey("E", 2)).toBe("D");
    expect(shapedKey("C", 0)).toBe("C");
    expect(shapedKey("F#m", 2)).toBe("Em");
  });
});

describe("displayChord", () => {
  it("shows the shapes the hands play, spelled for the shaped key", () => {
    const shaped = shapedKey("Eb", 3); // C
    expect(displayChord("Eb", 3, shaped)).toBe("C");
    expect(displayChord("Ab", 3, shaped)).toBe("F");
    expect(displayChord("Bb", 3, shaped)).toBe("G");
    expect(displayChord("Cm", 3, shaped)).toBe("Am");
  });
  it("is a pure respell at capo 0", () => {
    expect(displayChord("Eb", 0, "Eb")).toBe("Eb");
    expect(displayChord("D#", 0, "Eb")).toBe("Eb");
  });
  it("keeps slash chords coherent", () => {
    expect(displayChord("Eb/G", 3, "C")).toBe("C/E");
  });
});

describe("soundingFromShape", () => {
  it("round-trips what the user types under a capo", () => {
    expect(soundingFromShape("C", 3, "Eb")).toBe("Eb");
    expect(soundingFromShape("Am", 3, "Eb")).toBe("Cm");
    expect(soundingFromShape("G", 2, "A")).toBe("A");
  });
  it("spells the stored chord for the sounding key", () => {
    expect(soundingFromShape("A", 1, "Bb")).toBe("Bb");
    expect(soundingFromShape("A", 1, "B")).toBe("A#");
  });
});

describe("suggestCapo scores", () => {
  // Open shape +3, barre or awkward -1, unparseable 0, then half a point per fret.
  const scoreAt = (symbols: string[], fret: number) => suggestCapo(symbols, "C").find((s) => s.fret === fret)!.score;
  it.each([
    [["???"], 0, 0],
    [["???"], 2, -1],
    [["Am"], 0, 3],
    [["Cm"], 0, -1],
    [["G"], 0, 3],
    [["C9"], 0, 3],
    [["B"], 0, -1],
    [["Bm"], 0, -1],
    [["B7"], 0, 3],
    [["C#7"], 2, 2],
    [["Bdim"], 0, -1],
  ] as const)("%j at fret %i scores %d", (symbols, fret, score) => {
    expect(scoreAt([...symbols], fret)).toBe(score);
  });
});

describe("suggestCapo", () => {
  it("ranks open-friendly frets above fret 0 for a flat progression", () => {
    const ranked = suggestCapo(["Eb", "Ab", "Bb", "Cm"], "Eb");
    const fretOrder = ranked.map((s) => s.fret);
    const pos = (f: number) => fretOrder.indexOf(f);
    expect(pos(1)).toBeLessThan(pos(0));
    expect(pos(3)).toBeLessThan(pos(0));
  });
  it("reports the shaped key and shapes for each fret", () => {
    const ranked = suggestCapo(["Eb", "Ab", "Bb", "Cm"], "Eb");
    const fret3 = ranked.find((s) => s.fret === 3)!;
    expect(fret3.shapedKeyName).toBe("C");
    expect(fret3.shapes).toEqual(["C", "F", "G", "Am"]);
  });
  it("keeps an already-open song at fret 0", () => {
    const ranked = suggestCapo(["G", "C", "D", "Em"], "G");
    expect(ranked[0].fret).toBe(0);
  });
  it("returns all ten frets", () => {
    expect(suggestCapo(["C"], "C")).toHaveLength(10);
  });
});
