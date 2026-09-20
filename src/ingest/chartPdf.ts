import { normalizeSections } from "../client/lib/normalize";
import { extractLabelNotes } from "../client/lib/sectionMarks";
import { parseChord } from "../engine/chord";
import type { ChordPlacement, Song } from "../shared/types";

/**
 * Text-layer chord chart PDF to Song. Input is the word boxes poppler's
 * `pdftotext -bbox` reports; chords sit on their own row directly above the
 * lyric row, so a chord's x position maps to a character cell in that lyric.
 * Pure: no file or process access here, the script in scripts/ does that.
 * Layout constants are tuned to one chart vendor (see docs/PDF-INGEST.md).
 */

export interface WordBox {
  page: number;
  /** Width of the page the word sits on; the two columns split at half. */
  pageWidth: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  text: string;
}

export interface IngestOptions {
  /** Overrides the header key, which loses its own accidental ("Bb" reads "B"). */
  key?: string;
  /** ISO timestamp for createdAt and updatedAt. */
  now?: string;
}

export interface IngestResult {
  song: Song;
  /** Every correction and judgment call, for the human review pass. */
  log: string[];
}

// Glyph box heights by role, in points.
const H_LABEL = 10.9;
const H_BODY = 10.1;
const H_NOTE = 9.2;
const H_SMALL = 7.5;
const H_TOLERANCE = 0.3;
/** Words whose tops sit within this many points share a row (superscripts ride 1pt high). */
const ROW_TOLERANCE = 3;
/** Advance widths of the bold chord face at body size, for spotting a dropped glyph. */
const GLYPH: Record<string, number> = { A: 6.85, B: 6.9, D: 7.35, E: 5.55, F: 5.45, m: 9.7, "/": 4.0 };
/** A dropped accidental leaves about 5.3pt; anything past this is not kerning. */
const MISSING_GLYPH = 3.5;
/** Average lyric character width, for spacing chord-only rows. */
const CHAR_WIDTH = 5.6;

const SHARP_KEYS = ["G", "D", "A", "E", "B", "F#", "C#"];
const FLAT_KEYS = ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];
const SHARP_ORDER = "FCGDAEB";
const FLAT_ORDER = "BEADGCF";

const CHORD_FRAGMENT = /^(?:[A-G](?:m|dim|aug)?(?:\/[A-G])?|m(?:\/[A-G])?|\/[A-G])$/;

function decodeEntities(s: string): string {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

/** Parse `pdftotext -bbox` XHTML into word boxes. */
export function parseBboxHtml(html: string): WordBox[] {
  const words: WordBox[] = [];
  html.split("<page ").slice(1).forEach((chunk, page) => {
    const pageWidth = Number(/width="([\d.]+)"/.exec(chunk)?.[1] ?? 612);
    const re = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)<\/word>/g;
    for (let m = re.exec(chunk); m; m = re.exec(chunk)) {
      words.push({
        page,
        pageWidth,
        xMin: Number(m[1]),
        yMin: Number(m[2]),
        xMax: Number(m[3]),
        yMax: Number(m[4]),
        text: decodeEntities(m[5]),
      });
    }
  });
  return words;
}

type Row = WordBox[];

const height = (w: WordBox) => w.yMax - w.yMin;
const isH = (w: WordBox, h: number) => Math.abs(height(w) - h) <= H_TOLERANCE;

/** Reading order: page, then left column before right, then top to bottom. */
function toRows(words: WordBox[]): Row[] {
  const rows: Row[] = [];
  const pages = Math.max(-1, ...words.map((w) => w.page)) + 1;
  for (let page = 0; page < pages; page++) {
    for (const right of [false, true]) {
      const column = words
        .filter((w) => w.page === page && w.xMin >= w.pageWidth / 2 === right)
        .sort((a, b) => a.yMin - b.yMin || a.xMin - b.xMin);
      let current: Row = [];
      for (const w of column) {
        if (current.length > 0 && Math.abs(current[0].yMin - w.yMin) >= ROW_TOLERANCE) {
          rows.push(current);
          current = [];
        }
        current.push(w);
      }
      if (current.length > 0) rows.push(current);
    }
  }
  return rows.map((r) => [...r].sort((a, b) => a.xMin - b.xMin));
}

type RowKind = "label" | "note" | "chords" | "lyric" | "skip";

function classify(row: Row): RowKind {
  // A section label is a small bubble glyph followed by the label face.
  if (isH(row[0], H_SMALL) && row.length > 1 && row.slice(1).every((w) => isH(w, H_LABEL))) return "label";
  if (row.every((w) => isH(w, H_NOTE))) return "note";
  const body = row.filter((w) => isH(w, H_BODY));
  if (body.length === 0 || !row.every((w) => isH(w, H_BODY) || isH(w, H_SMALL))) return "skip";
  return body.every((w) => CHORD_FRAGMENT.test(w.text)) ? "chords" : "lyric";
}

interface RawChord {
  x: number;
  xMax: number;
  symbol: string;
}

interface KeyRule {
  accidental: "#" | "b";
  /** Note letters the key signature alters. */
  altered: Set<string>;
}

function keyRule(key: string, log: string[]): KeyRule {
  const tonic = /^[A-G][#b]?/.exec(key)?.[0] ?? "";
  const sharp = SHARP_KEYS.indexOf(tonic);
  if (sharp >= 0) return { accidental: "#", altered: new Set(SHARP_ORDER.slice(0, sharp + 1)) };
  const flat = FLAT_KEYS.indexOf(tonic);
  if (flat >= 0) {
    log.push(`flat key ${tonic}: accidental restoring is untested on flat charts, check every chord`);
    return { accidental: "b", altered: new Set(FLAT_ORDER.slice(0, flat + 1)) };
  }
  return { accidental: "#", altered: new Set() };
}

/**
 * Merge a chord row's fragments into symbols. The text layer drops accidental
 * glyphs; they are restored from what the geometry still shows.
 */
function assembleChords(row: Row, rule: KeyRule, log: string[]): RawChord[] {
  const chords: RawChord[] = [];
  for (const w of row) {
    const startsSymbol = isH(w, H_BODY) && /^[A-G]/.test(w.text);
    const last = chords[chords.length - 1];
    if (startsSymbol || !last) {
      let symbol = w.text;
      // A lone chord arrives as one word; a dropped accidental is unexplained width.
      const known = [...symbol].every((ch) => ch in GLYPH);
      const expected = [...symbol].reduce((sum, ch) => sum + (GLYPH[ch] ?? 0), 0);
      if (known && w.xMax - w.xMin - expected > MISSING_GLYPH) {
        const fixed = symbol[0] + rule.accidental + symbol.slice(1);
        log.push(`accidental restored from width: ${symbol} to ${fixed}`);
        symbol = fixed;
      }
      chords.push({ x: w.xMin, xMax: w.xMax, symbol });
      continue;
    }
    // A suffix fragment set off by a visible gap had an accidental before it.
    if (w.xMin - last.xMax > MISSING_GLYPH) {
      log.push(`accidental restored from gap: ${last.symbol} to ${last.symbol + rule.accidental}`);
      last.symbol += rule.accidental;
    }
    // A superscript 1 is a chart marking, not a chord quality.
    if (isH(w, H_SMALL) && w.text === "1") {
      log.push(`superscript 1 dropped from ${last.symbol}`);
    } else {
      last.symbol += w.text;
    }
    last.xMax = w.xMax;
  }
  for (const c of chords) {
    // An accidental at the very end of a symbol leaves no trace; the key signature decides.
    const bass = /\/([A-G])$/.exec(c.symbol)?.[1];
    if (bass && rule.altered.has(bass)) {
      log.push(`bass accidental restored from key: ${c.symbol} to ${c.symbol + rule.accidental}`);
      c.symbol += rule.accidental;
    }
    // The engine grammar reserves "/" for the bass note, so "6/9" becomes "69".
    if (!parseChord(c.symbol)) {
      const m = /^(.*)\/([A-G][#b]?)$/.exec(c.symbol);
      const rewritten = m ? `${m[1].replace(/\//g, "")}/${m[2]}` : c.symbol.replace(/\//g, "");
      if (parseChord(rewritten)) {
        log.push(`rewritten for the chord grammar: ${c.symbol} to ${rewritten}`);
        c.symbol = rewritten;
      } else {
        log.push(`UNPARSEABLE chord kept as printed: ${c.symbol}`);
      }
    }
  }
  return chords;
}

/** Chord x to character cell. Null means the chord sits past the end of the lyric. */
function columnFor(x: number, words: Row, starts: number[]): number | null {
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // In a gap (or left of an indented line): the space before the next word.
    if (x < w.xMin - 0.5) return Math.max(0, starts[i] - 1);
    if (x <= w.xMax) {
      const frac = (x - w.xMin) / (w.xMax - w.xMin);
      return starts[i] + Math.min(w.text.length - 1, Math.round(frac * w.text.length));
    }
  }
  return null;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface Meta {
  title: string;
  artist?: string;
  key?: string;
  tempo?: string;
  time?: string;
  writers?: string;
}

function readMeta(rows: Row[]): Meta {
  const meta: Meta = { title: "" };
  const firstPage = rows.filter((r) => r[0].page === 0);
  const titleRow = firstPage.reduce<Row | null>((best, r) => (!best || height(r[0]) > height(best[0]) ? r : best), null);
  if (titleRow) {
    meta.title = titleRow.map((w) => w.text).join(" ");
    const below = firstPage
      .filter((r) => r[0].yMin > titleRow[0].yMin && r[0].xMin < r[0].pageWidth / 2)
      .sort((a, b) => a[0].yMin - b[0].yMin)[0];
    if (below && !isH(below[0], H_SMALL)) meta.artist = below.map((w) => w.text).join(" ");
  }
  for (const row of rows) {
    const t = row.map((w) => w.text);
    const after = (tag: string) => (t.includes(tag) ? t[t.indexOf(tag) + 1] : undefined);
    meta.key ??= after("Key:");
    meta.tempo ??= after("Tempo:");
    meta.time ??= after("Time:");
    if (t[0] === "Writers:") meta.writers ??= t.slice(1).join(" ");
  }
  return meta;
}

export function ingestChart(words: WordBox[], options: IngestOptions = {}): IngestResult {
  const log: string[] = [];
  const rows = toRows(words);
  const meta = readMeta(rows);
  const key = options.key ?? meta.key;
  if (!key) log.push("no key found in the header: bass accidentals were not restored");
  const rule = keyRule(key ?? "C", log);

  const lyrics: string[] = [];
  const placements: ChordPlacement[] = [];
  let pending: RawChord[] | null = null;
  let notes: string[] = [];
  let seenLabel = false;

  const place = (line: number, col: number, chord: string) =>
    placements.push({ id: `p${placements.length + 1}`, line, col, chord });
  // Notes ride on the label line; extractLabelNotes promotes them to section marks.
  const flushNotes = () => {
    if (notes.length > 0) lyrics[lyrics.length - 1] += ` *${notes.join(", ")}*`;
    notes = [];
  };
  // A chord row with no lyric under it is an instrumental line.
  const flushInstrumental = () => {
    if (!pending) return;
    lyrics.push("");
    let end = -1;
    for (const c of pending) {
      const col = Math.max(Math.round((c.x - pending[0].x) / CHAR_WIDTH), end >= 0 ? end + 2 : 0);
      place(lyrics.length - 1, col, c.symbol);
      end = col + c.symbol.length - 1;
    }
    pending = null;
  };

  for (const row of rows) {
    const kind = classify(row);
    if (kind === "label") {
      flushInstrumental();
      flushNotes();
      if (lyrics.length > 0) lyrics.push("");
      lyrics.push(`[${titleCase(row.slice(1).map((w) => w.text).join(" "))}]`);
      seenLabel = true;
    } else if (!seenLabel || kind === "skip") {
      continue;
    } else if (kind === "note") {
      notes.push(row.map((w) => w.text).join(" "));
    } else if (kind === "chords") {
      flushNotes();
      flushInstrumental();
      pending = assembleChords(row, rule, log);
    } else {
      flushNotes();
      const starts: number[] = [];
      let text = "";
      for (const w of row) {
        if (text) text += " ";
        starts.push(text.length);
        text += w.text;
      }
      text = text.replace(/’/g, "'");
      lyrics.push(text);
      const line = lyrics.length - 1;
      let end = -1;
      for (const c of pending ?? []) {
        let col = columnFor(c.x, row, starts);
        if (col === null) {
          const tight = c.x - row[row.length - 1].xMax < 6;
          col = Math.max(text.length + (tight ? 1 : 2), end + 2);
          log.push(`line ${line}: ${c.symbol} sits past the end of the lyric`);
        }
        place(line, col, c.symbol);
        end = col + c.symbol.length - 1;
      }
      pending = null;
    }
  }
  flushInstrumental();
  flushNotes();

  const normalized = normalizeSections(lyrics, placements);
  const extracted = extractLabelNotes(normalized.lyrics, []);
  const now = options.now ?? new Date().toISOString();
  const bpm = Math.round(Number(meta.tempo));
  const credits = [meta.writers && `Writers: ${meta.writers}.`, meta.artist && `As recorded by ${meta.artist}.`];
  const song: Song = {
    version: 1,
    id: slugify(meta.title),
    title: meta.title,
    ...(meta.artist ? { artist: meta.artist } : {}),
    lyrics: extracted.lyrics,
    placements: normalized.placements,
    keyOverride: key ?? null,
    capo: 0,
    ...(Number.isFinite(bpm) && bpm >= 20 && bpm <= 400 ? { bpm } : {}),
    notes: [
      ["Ingested from a PDF chart.", [meta.time, meta.tempo && `tempo ${meta.tempo}`].filter(Boolean).join(", ")]
        .filter(Boolean)
        .join(" ")
        .replace(/[^.]$/, "$&."),
      credits.filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join("\n"),
    ...(extracted.sectionMarks.length > 0 ? { sectionMarks: extracted.sectionMarks } : {}),
    createdAt: now,
    updatedAt: now,
  };
  return { song, log };
}
