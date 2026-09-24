import type { WordBox } from "./chartPdf";

/**
 * PDF text operators to word boxes, grouped the way poppler's `pdftotext -bbox`
 * groups them, so chartPdf's layout constants hold in the browser too.
 * Pure: readPdf.ts turns a pdf.js operator list into these ops.
 */

/** A PDF affine matrix [a b c d e f], applied to row vectors: [x y 1] times M. */
export type Matrix = [number, number, number, number, number, number];

export interface Glyph {
  unicode: string;
  /** Advance in glyph space (1000 per em for most fonts, see FontMetrics.fontMatrix). */
  width: number;
  isSpace: boolean;
}

export type TextOp =
  | { op: "save" }
  | { op: "restore" }
  | { op: "transform"; m: Matrix }
  | { op: "beginText" }
  | { op: "font"; name: string; size: number }
  | { op: "textMatrix"; m: Matrix }
  | { op: "move"; x: number; y: number }
  | { op: "leading"; value: number }
  | { op: "nextLine" }
  | { op: "charSpacing"; value: number }
  | { op: "wordSpacing"; value: number }
  | { op: "hScale"; value: number }
  | { op: "rise"; value: number }
  /** Numbers are TJ adjustments in thousandths of an em, subtracted from the advance. */
  | { op: "show"; glyphs: (Glyph | number)[] };

export interface FontMetrics {
  /** Fractions of the font size above and below the baseline (descent is negative). */
  ascent: number;
  descent: number;
  /** Glyph space to text space. Only Type3 fonts differ from the 0.001 default. */
  fontMatrix?: Matrix;
}

export interface PageText {
  width: number;
  /** PDF user space to top-left page space, as pdf.js's viewport.transform gives it. */
  viewport: Matrix;
  ops: TextOp[];
  fonts: Record<string, FontMetrics>;
}

/** poppler's minWordBreakSpace: a gap wider than this fraction of the font size starts a new word. */
const WORD_BREAK = 0.1;
/** poppler's minDupBreakOverlap: a char this far left of the word's end starts a new word. */
const OVERLAP_BREAK = 0.2;
/** Baseline drift in points that still counts as the same word. */
const BASE_TOLERANCE = 0.5;

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** m1 then m2. */
function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
  ];
}

const apply = (m: Matrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

interface Char {
  x0: number;
  x1: number;
  base: number;
  size: number;
  ascent: number;
  descent: number;
  text: string;
}

interface OpenWord {
  xMin: number;
  xMax: number;
  base: number;
  size: number;
  yMin: number;
  yMax: number;
  text: string;
}

/** Every drawn glyph on one page, in content stream order. */
function pageChars(page: PageText): Char[] {
  const chars: Char[] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = page.viewport;
  let tm: Matrix = IDENTITY;
  let lineX = 0;
  let lineY = 0;
  let x = 0;
  let leading = 0;
  let charSpacing = 0;
  let wordSpacing = 0;
  let hScale = 1;
  let rise = 0;
  let font: FontMetrics = { ascent: 0.8, descent: -0.2 };
  let size = 0;

  for (const op of page.ops) {
    switch (op.op) {
      case "save":
        stack.push(ctm);
        break;
      case "restore":
        ctm = stack.pop() ?? ctm;
        break;
      case "transform":
        ctm = multiply(op.m, ctm);
        break;
      case "beginText":
        tm = IDENTITY;
        x = lineX = lineY = 0;
        break;
      case "font":
        font = page.fonts[op.name] ?? font;
        size = Math.abs(op.size);
        break;
      case "textMatrix":
        tm = op.m;
        x = lineX = lineY = 0;
        break;
      case "move":
        x = lineX += op.x;
        lineY += op.y;
        break;
      case "leading":
        leading = op.value;
        break;
      case "nextLine":
        x = lineX;
        lineY -= leading;
        break;
      case "charSpacing":
        charSpacing = op.value;
        break;
      case "wordSpacing":
        wordSpacing = op.value;
        break;
      case "hScale":
        hScale = op.value / 100;
        break;
      case "rise":
        rise = op.value;
        break;
      case "show": {
        const m = multiply(tm, ctm);
        const deviceSize = size * Math.hypot(m[2], m[3]);
        const scale = size * (font.fontMatrix?.[0] ?? 0.001);
        for (const g of op.glyphs) {
          if (typeof g === "number") {
            x -= (g * size * hScale) / 1000;
            continue;
          }
          const advance = (g.width * scale + charSpacing + (g.isSpace ? wordSpacing : 0)) * hScale;
          const [ax, base] = apply(m, x, lineY + rise);
          const [bx] = apply(m, x + advance, lineY + rise);
          chars.push({
            x0: Math.min(ax, bx),
            x1: Math.max(ax, bx),
            base,
            size: deviceSize,
            ascent: font.ascent,
            descent: font.descent,
            text: g.unicode,
          });
          x += advance;
        }
        break;
      }
    }
  }
  return chars;
}

/** Glyphs to words: whitespace, a gap, a size change, or a baseline shift ends a word. */
export function wordsFromPages(pages: PageText[]): WordBox[] {
  const words: WordBox[] = [];
  pages.forEach((page, index) => {
    let word: OpenWord | null = null;
    const close = () => {
      if (word) words.push({ page: index, pageWidth: page.width, xMin: word.xMin, yMin: word.yMin, xMax: word.xMax, yMax: word.yMax, text: word.text });
      word = null;
    };
    for (const c of pageChars(page)) {
      if (c.text === "" || /^\s+$/.test(c.text)) {
        close();
        continue;
      }
      const w = word as OpenWord | null;
      if (
        w &&
        (c.x0 - w.xMax > WORD_BREAK * w.size ||
          c.x0 - w.xMax < -OVERLAP_BREAK * w.size ||
          Math.abs(c.base - w.base) > BASE_TOLERANCE ||
          Math.abs(c.size - w.size) > 1e-6)
      ) {
        close();
      }
      if (word) {
        word.xMax = c.x1;
        word.text += c.text;
      } else {
        word = {
          xMin: c.x0,
          xMax: c.x1,
          base: c.base,
          size: c.size,
          yMin: c.base - c.ascent * c.size,
          yMax: c.base - c.descent * c.size,
          text: c.text,
        };
      }
    }
    close();
  });
  return words;
}
