function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Horizontal pixel offset inside a row to a character column. */
export function xToCol(xPx: number, charWidthPx: number, maxCol: number): number {
  if (charWidthPx <= 0 || maxCol <= 0) return 0;
  return clamp(Math.round(xPx / charWidthPx), 0, maxCol);
}

/** New column for a drag that started at startCol and moved dxPx. */
export function dragCol(startCol: number, dxPx: number, charWidthPx: number, maxCol: number): number {
  if (charWidthPx <= 0) return clamp(startCol, 0, Math.max(0, maxCol));
  return clamp(startCol + Math.round(dxPx / charWidthPx), 0, Math.max(0, maxCol));
}

/** New line for a drag that moved dyPx across uniform line pairs. */
export function dragLine(startLine: number, dyPx: number, pairHeightPx: number, lineCount: number): number {
  if (pairHeightPx <= 0 || lineCount <= 0) return startLine;
  return clamp(startLine + Math.round(dyPx / pairHeightPx), 0, lineCount - 1);
}
