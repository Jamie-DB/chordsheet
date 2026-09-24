import { describe, expect, it } from "vitest";
import { wordsFromPages, type Glyph, type Matrix, type PageText, type TextOp } from "./pdfWords";

// A US Letter page. The viewport flips PDF space (origin bottom left) to top left.
const VIEWPORT: Matrix = [1, 0, 0, -1, 0, 792];
const FONTS = { f1: { ascent: 0.75, descent: -0.25 } };
/** 500 glyph units per letter, so each letter advances 5pt at size 10. */
const g = (unicode: string, width = 500): Glyph => ({ unicode, width, isSpace: unicode === " " });
const show = (text: string, width = 500): TextOp => ({ op: "show", glyphs: [...text].map((c) => g(c, width)) });

function page(ops: TextOp[], width = 612): PageText {
  return { width, viewport: VIEWPORT, fonts: FONTS, ops: [{ op: "beginText" }, { op: "font", name: "f1", size: 10 }, ...ops] };
}
const at = (x: number, y: number): TextOp => ({ op: "textMatrix", m: [1, 0, 0, 1, x, y] });
const texts = (pages: PageText[]) => wordsFromPages(pages).map((w) => w.text);

describe("wordsFromPages", () => {
  it("places a word with poppler's box: advance widths across, ascent and descent around the baseline", () => {
    expect(wordsFromPages([page([at(100, 700), show("Amazing")])])).toEqual([
      { page: 0, pageWidth: 612, xMin: 100, xMax: 135, yMin: 92 - 7.5, yMax: 92 + 2.5, text: "Amazing" },
    ]);
  });

  it("breaks on whitespace and on a gap wider than a tenth of the font size, joins across a kerning gap", () => {
    const ops = [
      at(100, 700),
      show("Amazing grace"),
      at(200, 700),
      show("ho"),
      at(210.9, 700), // 0.9pt gap: kerning, same word
      show("w"),
      at(221, 700), // 5pt gap: the space a dropped accidental leaves
      show("m"),
    ];
    expect(texts([page(ops)])).toEqual(["Amazing", "grace", "how", "m"]);
  });

  it("joins glyphs drawn by separate show operators, one glyph at a time", () => {
    const ops = [at(100, 700), show("G"), { op: "move", x: 5, y: 0 } as TextOp, show("7")];
    expect(texts([page(ops)])).toEqual(["G7"]);
  });

  it("starts a new word on a size change, as a superscript does", () => {
    const ops: TextOp[] = [at(100, 700), show("D"), { op: "font", name: "f1", size: 7 }, show("7")];
    const words = wordsFromPages([page(ops)]);
    expect(words.map((w) => w.text)).toEqual(["D", "7"]);
    expect(words[1].yMax - words[1].yMin).toBeCloseTo(7);
  });

  it("starts a new word when the baseline moves", () => {
    expect(texts([page([at(100, 700), show("G"), at(105, 690), show("C")])])).toEqual(["G", "C"]);
  });

  it("applies TJ adjustments, spacing, and horizontal scale to the advance", () => {
    const tj: TextOp = { op: "show", glyphs: [g("A"), -2000, g("B")] }; // pushes B 20pt right
    const scaled: TextOp[] = [
      { op: "hScale", value: 50 },
      { op: "charSpacing", value: 1 },
      at(300, 700),
      show("CD"), // each glyph advances (5 + 1) * 0.5 = 3pt
    ];
    const words = wordsFromPages([page([at(100, 700), tj, ...scaled])]);
    expect(words.map((w) => [w.text, w.xMin, w.xMax])).toEqual([
      ["A", 100, 105],
      ["B", 125, 130],
      ["CD", 300, 306],
    ]);
  });

  it("composes the current transform and the text matrix, and restores the transform", () => {
    // Qt style: a flipped, scaled page transform, then a flipped text matrix.
    const ops: TextOp[] = [
      { op: "save" },
      { op: "transform", m: [0.5, 0, 0, -0.5, 0, 792] },
      { op: "beginText" },
      { op: "font", name: "f1", size: 20 },
      { op: "textMatrix", m: [1, 0, 0, -1, 0, 0] },
      { op: "move", x: 200, y: -200 },
      show("Grace"),
      { op: "restore" },
      { op: "beginText" },
      { op: "font", name: "f1", size: 10 },
      at(100, 600),
      show("Newton"),
    ];
    const words = wordsFromPages([page(ops)]);
    expect(words[0]).toMatchObject({ text: "Grace", xMin: 100, xMax: 125, yMin: 100 - 7.5, yMax: 100 + 2.5 });
    expect(words[1]).toMatchObject({ text: "Newton", xMin: 100, yMin: 192 - 7.5 });
  });

  it("moves down by the leading on a new line", () => {
    const ops: TextOp[] = [at(100, 700), { op: "leading", value: 12 }, show("How"), { op: "nextLine" }, show("sweet")];
    const words = wordsFromPages([page(ops)]);
    expect(words.map((w) => [w.text, w.xMin, w.yMax])).toEqual([
      ["How", 100, 94.5],
      ["sweet", 100, 106.5],
    ]);
  });

  it("leaves a glyph with no text as a gap, the trace a dropped accidental leaves, and numbers pages from zero", () => {
    const first = page([at(100, 700), { op: "show", glyphs: [g("F"), g(""), g("m")] }]);
    const second = page([at(100, 700), show("D")], 600);
    expect(wordsFromPages([first, second]).map((w) => [w.page, w.pageWidth, w.text, w.xMin])).toEqual([
      [0, 612, "F", 100],
      [0, 612, "m", 110],
      [1, 600, "D", 100],
    ]);
  });

  it("uses a Type3 font matrix for glyph widths", () => {
    const pages: PageText[] = [
      {
        width: 612,
        viewport: VIEWPORT,
        fonts: { t3: { ascent: 0.75, descent: -0.25, fontMatrix: [0.01, 0, 0, 0.01, 0, 0] } },
        ops: [{ op: "beginText" }, { op: "font", name: "t3", size: 10 }, at(100, 700), show("G", 50)],
      },
    ];
    expect(wordsFromPages(pages)[0]).toMatchObject({ xMin: 100, xMax: 105 });
  });

  it("returns nothing for a page with no text, as a scan has", () => {
    expect(wordsFromPages([{ width: 612, viewport: VIEWPORT, fonts: {}, ops: [] }])).toEqual([]);
  });
});
