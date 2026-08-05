import { describe, expect, it } from "vitest";
import { transposeSymbol } from "./transpose";

describe("transposeSymbol", () => {
  it("is identity at 12 semitones", () => {
    for (const s of ["C", "Am7", "Bbmaj7", "F#m", "G/B"]) {
      expect(transposeSymbol(s, 12, "sharp")).toBe(s.replace("Bb", "A#"));
    }
    expect(transposeSymbol("Bbmaj7", 12, "flat")).toBe("Bbmaj7");
  });

  it("transposes roots and basses together", () => {
    expect(transposeSymbol("Bb", 2, "sharp")).toBe("C");
    expect(transposeSymbol("G/B", 2, "sharp")).toBe("A/C#");
    expect(transposeSymbol("Am7/G", -2, "sharp")).toBe("Gm7/F");
  });

  it("spells for the target context", () => {
    expect(transposeSymbol("F#", 1, "flat")).toBe("G");
    expect(transposeSymbol("A", 1, "flat")).toBe("Bb");
    expect(transposeSymbol("A", 1, "sharp")).toBe("A#");
    expect(transposeSymbol("F", 1, "sharp")).toBe("F#");
    expect(transposeSymbol("F", 1, "flat")).toBe("Gb");
  });

  it("handles negative distances", () => {
    expect(transposeSymbol("C", -1, "sharp")).toBe("B");
    expect(transposeSymbol("Eb", -3, "sharp")).toBe("C");
  });

  it("returns unparseable symbols unchanged", () => {
    expect(transposeSymbol("N.C.", 2, "sharp")).toBe("N.C.");
  });
});
