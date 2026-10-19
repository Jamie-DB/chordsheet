import { describe, expect, it } from "vitest";
import { isStaffLine, lowestFret, positionLabel, shiftTab } from "./tab";

const RIFF = [
  "e|---------------|",
  "B|-----------0---|",
  "G|-------0-2---0-|",
  "D|-0-2-4---------|",
  "A|---------------|",
  "E|---------------|",
];

describe("isStaffLine", () => {
  it.each([
    ["e|---0---|", true],
    ["E|---", true],
    ["  B |-3-", true],
    ["F#|-2-", true],
    ["Eb|-2-", true],
    ["Amazing grace", false],
    ["Bridge | lick", false],
    ["", false],
    ["| G . . |", false],
  ])("%j is %s", (line, expected) => {
    expect(isStaffLine(line)).toBe(expected);
  });
});

describe("lowestFret and positionLabel", () => {
  it("finds the lowest fret on the staff", () => {
    expect(lowestFret(RIFF)).toBe(0);
    expect(positionLabel(RIFF)).toBe("open position");
  });

  it("names a fret position when nothing is open", () => {
    expect(positionLabel(["e|-5-7-|", "B|-8---|"])).toBe("fret 5");
  });

  it("ignores digits outside the staff", () => {
    expect(lowestFret(["Intro x2 (0:04)", "G|-7-9-|"])).toBe(7);
  });

  it("is null for a tab with no notes", () => {
    expect(lowestFret(["e|-----|"])).toBeNull();
    expect(positionLabel(["just words"])).toBeNull();
  });
});

describe("shiftTab", () => {
  it("leaves the tab alone for a zero shift", () => {
    expect(shiftTab(RIFF, 0)).toBe(RIFF);
  });

  it("moves single-digit frets in place", () => {
    expect(shiftTab(RIFF, 2)).toEqual([
      "e|---------------|",
      "B|-----------2---|",
      "G|-------2-4---2-|",
      "D|-2-4-6---------|",
      "A|---------------|",
      "E|---------------|",
    ]);
  });

  it("widens a column on every string when a fret gains a digit", () => {
    expect(shiftTab(["e|-8-9-|", "B|-----|"], 2)).toEqual(["e|-10-11-|", "B|-------|"]);
  });

  it("narrows a column when every fret in it loses a digit", () => {
    expect(shiftTab(["e|-10-|", "B|----|"], -2)).toEqual(["e|-8-|", "B|---|"]);
  });

  it("keeps a chord's notes in one column", () => {
    expect(shiftTab(["G|-9-|", "D|-9-|", "A|-7-|"], 2)).toEqual(["G|-11-|", "D|-11-|", "A|-9--|"]);
  });

  it("treats overlapping numbers on different strings as one column", () => {
    expect(shiftTab(["D|-12-|", "G|--5-|"], 1)).toEqual(["D|-13-|", "G|--6-|"]);
  });

  it("jumps up an octave when a note would fall below the nut", () => {
    expect(shiftTab(["D|-0-2-|"], -2)).toEqual(["D|-10-12-|"]);
  });

  it("drops an octave when a note would pass fret 24", () => {
    expect(shiftTab(["e|-22-24-|"], 3)).toEqual(["e|-13-15-|"]);
  });

  it("keeps technique letters, bars, and non-staff lines", () => {
    expect(shiftTab(["Intro hook, let ring", "B|-5h7-|-8b10-|"], 1)).toEqual([
      "Intro hook, let ring",
      "B|-6h8-|-9b11-|",
    ]);
  });

  it("round-trips a shift and its inverse", () => {
    expect(shiftTab(shiftTab(RIFF, 3), -3)).toEqual(RIFF);
  });
});
