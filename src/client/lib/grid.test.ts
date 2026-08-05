import { describe, expect, it } from "vitest";
import { dragCol, dragLine, xToCol } from "./grid";

describe("xToCol", () => {
  it("rounds to the nearest cell", () => {
    expect(xToCol(0, 8, 40)).toBe(0);
    expect(xToCol(3.9, 8, 40)).toBe(0);
    expect(xToCol(4.1, 8, 40)).toBe(1);
    expect(xToCol(80, 8, 40)).toBe(10);
  });
  it("clamps past the end of the line", () => {
    expect(xToCol(9999, 8, 34)).toBe(34);
    expect(xToCol(-50, 8, 34)).toBe(0);
  });
  it("degrades safely with a zero char width", () => {
    expect(xToCol(100, 0, 34)).toBe(0);
  });
});

describe("dragCol", () => {
  it("moves by whole cells", () => {
    expect(dragCol(10, 24, 8, 40)).toBe(13);
    expect(dragCol(10, -24, 8, 40)).toBe(7);
    expect(dragCol(10, 3, 8, 40)).toBe(10);
  });
  it("clamps to the line", () => {
    expect(dragCol(38, 100, 8, 40)).toBe(40);
    expect(dragCol(2, -100, 8, 40)).toBe(0);
  });
});

describe("dragLine", () => {
  it("crosses lines by whole pairs", () => {
    expect(dragLine(2, 50, 44, 10)).toBe(3);
    expect(dragLine(2, -50, 44, 10)).toBe(1);
    expect(dragLine(2, 10, 44, 10)).toBe(2);
  });
  it("clamps to the song", () => {
    expect(dragLine(0, -500, 44, 10)).toBe(0);
    expect(dragLine(9, 500, 44, 10)).toBe(9);
  });
});
