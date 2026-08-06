import { isChordSymbol, transposeSymbol } from "../../engine";
import type { ChordPlacement } from "../../shared/types";
import { freshId } from "./ids";
import { isSectionLabel } from "./lineOps";
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

// Rhythm notation that may share a chord row: slashes, dashes, dots, repeats.
const RHYTHM_TOKEN = /^(\/+|-+|\.+|\(?(?:\d+[xX]|[xX]\d+)\)?)$/;

export interface ChordNotation {
  /** Chord tokens at their exact columns. */
  chords: Token[];
  tokenCount: number;
  hasRhythm: boolean;
}

/**
 * Recognize a chord row, including bar notation like "|C / / /|Csus / / /|".
 * Pipes are treated as spacing (they never shift columns); the line
 * qualifies when it has at least one chord and every token is a chord or a
 * rhythm mark. Returns null for anything else.
 */
export function parseChordNotationLine(line: string): ChordNotation | null {
  const tokens = tokenize(line.replace(/\|/g, " "));
  if (tokens.length === 0) return null;
  const chords: Token[] = [];
  let hasRhythm = false;
  for (const token of tokens) {
    if (isChordSymbol(token.text)) chords.push(token);
    else if (RHYTHM_TOKEN.test(token.text)) hasRhythm = true;
    else return null;
  }
  if (chords.length === 0) return null;
  return { chords, tokenCount: tokens.length, hasRhythm };
}

/**
 * A chord line has at least one chord and nothing but chords and rhythm
 * marks. Lyric lines consisting of a single note-name word ("A") are the
 * known false positive; the editor makes that a one-click fix.
 */
export function isChordLine(line: string): boolean {
  return parseChordNotationLine(line) !== null;
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

  const addPlacements = (notation: ChordNotation, targetLine: number) => {
    for (const token of notation.chords) {
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
    const notation = parseChordNotationLine(line);
    if (!notation) {
      lyrics.push(line);
      continue;
    }
    chordLinesConverted += 1;
    const next = raw[i + 1];
    const nextIsLyric =
      next !== undefined && next.length > 0 && !isChordLine(next) && !isSectionLabel(next);
    if (nextIsLyric) {
      // The lyric line will be pushed on the next iteration at this index.
      addPlacements(notation, lyrics.length);
    } else {
      // Standalone chord row: keep it printable over an inserted empty line.
      addPlacements(notation, lyrics.length);
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

export interface RepairResult {
  lyrics: string[];
  placements: ChordPlacement[];
  /** Chord-text lines converted to placements. */
  converted: number;
  changed: boolean;
}

/**
 * Convert chord rows that live as lyric TEXT (an older parser missed bar
 * notation) into real placements, so they transpose and capo. Attaches to
 * the following plain lyric line when it has no chords yet; otherwise the
 * chords stand alone over the blanked line. Extra safety for existing data:
 * single bare note-words ("A") are never converted. Placement ids are
 * deterministic so browser and disk repairs produce identical files.
 */
export function repairChordTextLines(
  lyrics: string[],
  placements: ChordPlacement[],
): RepairResult {
  const linesWithChords = new Set(placements.map((p) => p.line));

  const newLyrics: string[] = [];
  const map = new Map<number, number>();
  const added: ChordPlacement[] = [];
  let converted = 0;

  for (let i = 0; i < lyrics.length; i++) {
    const line = lyrics[i];
    const notation = parseChordNotationLine(line);
    const eligible =
      notation !== null &&
      !linesWithChords.has(i) &&
      (notation.tokenCount >= 2 || notation.hasRhythm);

    if (!eligible) {
      map.set(i, newLyrics.length);
      newLyrics.push(line);
      continue;
    }

    converted += 1;
    const next = lyrics[i + 1];
    const attachToNext =
      next !== undefined &&
      next.trim().length > 0 &&
      parseChordNotationLine(next) === null &&
      !isSectionLabel(next) &&
      !linesWithChords.has(i + 1);

    const target = newLyrics.length;
    for (const token of notation.chords) {
      added.push({ id: `repair-${target}-${token.col}`, line: target, col: token.col, chord: token.text });
    }
    if (!attachToNext) {
      // Standalone: the chords sit over what becomes an empty line.
      map.set(i, newLyrics.length);
      newLyrics.push("");
    }
    // When attaching, this text row disappears; the next (kept) lyric line
    // lands exactly at `target` on its own iteration.
  }

  const remapped = placements.map((p) => {
    const line = map.get(p.line);
    return line === undefined || line === p.line ? p : { ...p, line };
  });
  const all = [...remapped, ...added];
  return {
    lyrics: newLyrics,
    placements: all,
    converted,
    changed: converted > 0,
  };
}
