import { describe, expect, it } from "vitest";
import { detectKey, keyName, keyPrefersFlat, parseKeyName, transposeKeyName } from "./key";

describe("parseKeyName", () => {
  it("parses major and minor names", () => {
    expect(parseKeyName("Eb")).toEqual({ tonicPc: 3, mode: "major" });
    expect(parseKeyName("F#m")).toEqual({ tonicPc: 6, mode: "minor" });
    expect(parseKeyName("Cm")).toEqual({ tonicPc: 0, mode: "minor" });
    expect(parseKeyName("X")).toBeNull();
  });
});

describe("keyPrefersFlat", () => {
  const flat = ["F", "Bb", "Eb", "Ab", "Db", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"];
  const sharp = ["C", "G", "D", "A", "E", "B", "F#", "Am", "Em", "Bm", "F#m", "C#m", "G#m"];
  it.each(flat)("%s is a flat key", (k) => expect(keyPrefersFlat(k)).toBe(true));
  it.each(sharp)("%s is a sharp key", (k) => expect(keyPrefersFlat(k)).toBe(false));
});

describe("keyName and transposeKeyName", () => {
  it("canonicalizes spelling per key signature", () => {
    expect(keyName(3, "major")).toBe("Eb");
    expect(keyName(6, "major")).toBe("F#");
    expect(keyName(3, "minor")).toBe("Ebm");
    expect(keyName(8, "minor")).toBe("G#m");
  });
  it("transposes key names canonically", () => {
    expect(transposeKeyName("Eb", -3)).toBe("C");
    expect(transposeKeyName("C", -2)).toBe("Bb");
    expect(transposeKeyName("Am", 2)).toBe("Bm");
    expect(transposeKeyName("E", 1)).toBe("F");
  });
});

describe("detectKey", () => {
  it("hears G major in G D Em C", () => {
    expect(detectKey(["G", "D", "Em", "C"])?.name).toBe("G");
  });
  it("hears A minor when Am leads", () => {
    expect(detectKey(["Am", "F", "C", "G"])?.name).toBe("Am");
  });
  it("hears Eb major in a flat progression", () => {
    expect(detectKey(["Eb", "Ab", "Bb", "Cm"])?.name).toBe("Eb");
  });
  it("hears E minor with a harmonic-minor dominant", () => {
    expect(detectKey(["Em", "Am", "B7", "Em"])?.name).toBe("Em");
  });
  it("handles sevenths and slash chords", () => {
    expect(detectKey(["Cmaj7", "Am7", "Dm7", "G7"])?.name).toBe("C");
    expect(detectKey(["G", "D/F#", "Em", "C"])?.name).toBe("G");
  });
  it("returns null with nothing to score", () => {
    expect(detectKey([])).toBeNull();
    expect(detectKey(["???"])).toBeNull();
  });
  it("reports lower confidence for ambiguous progressions", () => {
    const clear = detectKey(["G", "C", "D", "G"])!;
    const vague = detectKey(["C", "G"])!;
    expect(clear.confidence).toBeGreaterThan(vague.confidence);
  });
});
