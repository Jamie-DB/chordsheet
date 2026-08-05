import { describe, expect, it } from "vitest";
import { mod12, noteToPc, pcToName } from "./notes";

describe("noteToPc", () => {
  it("maps naturals", () => {
    expect(noteToPc("C")).toBe(0);
    expect(noteToPc("D")).toBe(2);
    expect(noteToPc("B")).toBe(11);
  });
  it("maps accidentals", () => {
    expect(noteToPc("F#")).toBe(6);
    expect(noteToPc("Bb")).toBe(10);
    expect(noteToPc("Cb")).toBe(11);
    expect(noteToPc("B#")).toBe(0);
  });
  it("rejects non-notes", () => {
    expect(noteToPc("H")).toBeNull();
    expect(noteToPc("c")).toBeNull();
    expect(noteToPc("")).toBeNull();
  });
});

describe("pcToName", () => {
  it("spells by preference", () => {
    expect(pcToName(6, "sharp")).toBe("F#");
    expect(pcToName(6, "flat")).toBe("Gb");
    expect(pcToName(10, "flat")).toBe("Bb");
    expect(pcToName(10, "sharp")).toBe("A#");
  });
  it("wraps out-of-range pitch classes", () => {
    expect(pcToName(12, "sharp")).toBe("C");
    expect(pcToName(-1, "flat")).toBe("B");
  });
});

describe("mod12", () => {
  it("normalizes negatives", () => {
    expect(mod12(-3)).toBe(9);
    expect(mod12(14)).toBe(2);
  });
});
