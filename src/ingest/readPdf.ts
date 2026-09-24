import { OPS, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { WordBox } from "./chartPdf";
import { wordsFromPages, type FontMetrics, type Glyph, type Matrix, type PageText, type TextOp } from "./pdfWords";

/**
 * PDF bytes to word boxes, through pdf.js. Runs in the browser (the caller sets
 * GlobalWorkerOptions.workerSrc first) and in Node (the ingest script).
 * Only the operator list is read: nothing is rendered and no script runs.
 */

const toMatrix = (m: ArrayLike<number>): Matrix => Array.from(m).slice(0, 6) as Matrix;

interface PdfGlyph {
  unicode: string;
  width: number;
  isSpace: boolean;
}

function toTextOp(fn: number, args: unknown[]): TextOp[] {
  switch (fn) {
    case OPS.save:
      return [{ op: "save" }];
    case OPS.restore:
      return [{ op: "restore" }];
    case OPS.transform:
      return [{ op: "transform", m: toMatrix(args as number[]) }];
    case OPS.paintFormXObjectBegin:
      return args[0] ? [{ op: "save" }, { op: "transform", m: toMatrix(args[0] as number[]) }] : [{ op: "save" }];
    case OPS.paintFormXObjectEnd:
      return [{ op: "restore" }];
    case OPS.beginText:
      return [{ op: "beginText" }];
    case OPS.setFont:
      return [{ op: "font", name: args[0] as string, size: args[1] as number }];
    case OPS.setTextMatrix:
      return [{ op: "textMatrix", m: toMatrix(args[0] as ArrayLike<number>) }];
    case OPS.moveText:
      return [{ op: "move", x: args[0] as number, y: args[1] as number }];
    case OPS.setLeadingMoveText:
      return [
        { op: "leading", value: -(args[1] as number) },
        { op: "move", x: args[0] as number, y: args[1] as number },
      ];
    case OPS.setLeading:
      return [{ op: "leading", value: args[0] as number }];
    case OPS.nextLine:
      return [{ op: "nextLine" }];
    case OPS.setCharSpacing:
      return [{ op: "charSpacing", value: args[0] as number }];
    case OPS.setWordSpacing:
      return [{ op: "wordSpacing", value: args[0] as number }];
    case OPS.setHScale:
      return [{ op: "hScale", value: args[0] as number }];
    case OPS.setTextRise:
      return [{ op: "rise", value: args[0] as number }];
    case OPS.showText: {
      const glyphs = (args[0] as (PdfGlyph | number | null)[])
        .filter((g) => g !== null)
        .map((g): Glyph | number => (typeof g === "number" ? g : { unicode: g.unicode, width: g.width, isSpace: g.isSpace }));
      return [{ op: "show", glyphs }];
    }
    default:
      return [];
  }
}

export async function readPdfWords(data: Uint8Array): Promise<WordBox[]> {
  const task = getDocument({ data });
  try {
    const doc = await task.promise;
    const pages: PageText[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const list = await page.getOperatorList();
      const ops = list.fnArray.flatMap((fn, i) => toTextOp(fn, list.argsArray[i] as unknown[]));
      const fonts: Record<string, FontMetrics> = {};
      for (const op of ops) {
        if (op.op !== "font" || op.name in fonts) continue;
        const font = await new Promise<{ ascent?: number; descent?: number; fontMatrix?: number[] }>((resolve) =>
          page.commonObjs.get(op.name, resolve),
        );
        fonts[op.name] = {
          ascent: font.ascent ?? 0.8,
          descent: font.descent ?? -0.2,
          ...(font.fontMatrix ? { fontMatrix: toMatrix(font.fontMatrix) } : {}),
        };
      }
      pages.push({ width: viewport.width, viewport: toMatrix(viewport.transform), ops, fonts });
      page.cleanup();
    }
    return wordsFromPages(pages);
  } finally {
    await task.destroy();
  }
}
