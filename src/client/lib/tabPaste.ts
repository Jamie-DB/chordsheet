import { isChordSymbol, transposeSymbol } from "../../engine";
import type { ChordPlacement } from "../../shared/types";
import { freshId } from "./ids";
import { isPageArtifact, normalizeSections } from "./normalize";
import { lyricsFromPaste } from "./storage";

export interface ParsedTab {
  lyrics: string[];
  placements: ChordPlacement[];
  /** How many chord lines were converted into placements. */
  chordLinesConverted: number;
  /** Tempo found in the pasted text ("Tempo: 120", "96 bpm"), else null. */
  bpm: number | null;
}

/** Scan pasted text for a tempo declaration. The line itself is kept as text. */
export function detectBpm(lines: string[]): number | null {
  for (const line of lines) {
    const m = /\b(\d{2,3})\s*bpm\b/i.exec(line) ?? /\btempo\b[^0-9]{0,6}(\d{2,3})/i.exec(line);
    if (m) {
      const bpm = Number(m[1]);
      if (bpm >= 30 && bpm <= 300) return bpm;
    }
  }
  return null;
}

interface Token {
  col: number;
  text: string;
}

function tokenize(line: string): Token[] {
  return [...line.matchAll(/\S+/g)].map((m) => ({ col: m.index ?? 0, text: m[0] }));
}

/**
 * A chord line is non-empty and every token parses as a chord symbol.
 * Lyric lines that consist of a single note-name word ("A") are the known
 * false positive; the editor makes that a one-click fix.
 */
export function isChordLine(line: string): boolean {
  const tokens = tokenize(line);
  return tokens.length > 0 && tokens.every((t) => isChordSymbol(t.text));
}

/**
 * Parse pasted text that may interleave chord rows with lyric lines (the
 * standard found-tab layout). Chord rows become placements at their exact
 * columns on the following lyric line and disappear from the lyrics; chord
 * rows with no lyric line under them (intros, instrumentals, stacked rows)
 * attach to an inserted empty line so they still print standalone.
 *
 * writtenForCapo: when the source tab was written for a capo, its symbols
 * are shapes at that fret; they are transposed up to sounding for storage.
 */
export function parsePastedTab(text: string, writtenForCapo: number = 0): ParsedTab {
  // Page artifacts go first so they can never sit between a chord row and
  // its lyric line and swallow the placements.
  const raw = lyricsFromPaste(text).filter((line) => !isPageArtifact(line));
  const lyrics: string[] = [];
  const placements: ChordPlacement[] = [];
  let chordLinesConverted = 0;

  const toSounding = (symbol: string): string =>
    writtenForCapo > 0 ? transposeSymbol(symbol, writtenForCapo, "sharp") : symbol;

  const addPlacements = (line: string, targetLine: number) => {
    for (const token of tokenize(line)) {
      placements.push({
        id: freshId(),
        line: targetLine,
        col: token.col,
        chord: toSounding(token.text),
      });
    }
  };

  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    if (!isChordLine(line)) {
      lyrics.push(line);
      continue;
    }
    chordLinesConverted += 1;
    const next = raw[i + 1];
    const nextIsLyric = next !== undefined && next.length > 0 && !isChordLine(next);
    if (nextIsLyric) {
      // The lyric line will be pushed on the next iteration at this index.
      addPlacements(line, lyrics.length);
    } else {
      // Standalone chord row: keep it printable over an inserted empty line.
      addPlacements(line, lyrics.length);
      lyrics.push("");
    }
  }

  const normalized = normalizeSections(lyrics, placements);
  return {
    lyrics: normalized.lyrics,
    placements: normalized.placements,
    chordLinesConverted,
    bpm: detectBpm(raw),
  };
}
