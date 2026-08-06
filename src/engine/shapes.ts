import { chordFamily, parseChord } from "./chord";
import { mod12 } from "./notes";

/**
 * Guitar voicings for chord diagrams. Coverage comes from a curated
 * open-chord table plus movable E-form and A-form templates, so every root
 * has a shape for the core qualities. Unusual chords walk a simplification
 * ladder to the closest reasonable shape (Jamie: "I'm no pro").
 */

export interface Voicing {
  /** Low E to high E; -1 = muted, 0 = open, else absolute fret. */
  frets: number[];
  /** First fret drawn on the grid; 1 means the nut is visible. */
  baseFret: number;
}

export interface ShapeResult {
  voicing: Voicing;
  /** Root as written plus the quality actually voiced, e.g. "Cmaj7". */
  playedAs: string;
  /** True when the shape is a simplification of the requested chord. */
  approximated: boolean;
}

const X = -1;

// Open and low-position chords, keyed by `${pc}:${quality}`.
const OPEN: Record<string, number[]> = {
  "0:": [X, 3, 2, 0, 1, 0],        // C
  "9:": [X, 0, 2, 2, 2, 0],        // A
  "7:": [3, 2, 0, 0, 0, 3],        // G
  "4:": [0, 2, 2, 1, 0, 0],        // E
  "2:": [X, X, 0, 2, 3, 2],        // D
  "5:": [1, 3, 3, 2, 1, 1],        // F
  "9:m": [X, 0, 2, 2, 1, 0],       // Am
  "4:m": [0, 2, 2, 0, 0, 0],       // Em
  "2:m": [X, X, 0, 2, 3, 1],       // Dm
  "0:7": [X, 3, 2, 3, 1, 0],       // C7
  "9:7": [X, 0, 2, 0, 2, 0],       // A7
  "11:7": [X, 2, 1, 2, 0, 2],      // B7
  "2:7": [X, X, 0, 2, 1, 2],       // D7
  "4:7": [0, 2, 0, 1, 0, 0],       // E7
  "7:7": [3, 2, 0, 0, 0, 1],       // G7
  "9:m7": [X, 0, 2, 0, 1, 0],      // Am7
  "4:m7": [0, 2, 0, 0, 0, 0],      // Em7
  "2:m7": [X, X, 0, 2, 1, 1],      // Dm7
  "0:maj7": [X, 3, 2, 0, 0, 0],    // Cmaj7
  "5:maj7": [X, X, 3, 2, 1, 0],    // Fmaj7
  "9:maj7": [X, 0, 2, 1, 2, 0],    // Amaj7
  "2:maj7": [X, X, 0, 2, 2, 2],    // Dmaj7
  "4:maj7": [0, 2, 1, 1, 0, 0],    // Emaj7
  "7:maj7": [3, 2, 0, 0, 0, 2],    // Gmaj7
  "0:sus4": [X, 3, 3, 0, 1, 0],    // Csus4, one finger from open C
  "9:sus2": [X, 0, 2, 2, 0, 0],    // Asus2
  "9:sus4": [X, 0, 2, 2, 3, 0],    // Asus4
  "2:sus2": [X, X, 0, 2, 3, 0],    // Dsus2
  "2:sus4": [X, X, 0, 2, 3, 3],    // Dsus4
  "4:sus4": [0, 2, 2, 2, 0, 0],    // Esus4
  "9:7sus4": [X, 0, 2, 0, 3, 0],   // A7sus4
  "0:add9": [X, 3, 2, 0, 3, 0],    // Cadd9
  "7:add9": [3, 2, 0, 2, 0, 3],    // Gadd9
  "4:add9": [0, 2, 2, 1, 0, 2],    // Eadd9
  "0:6": [X, 3, 2, 2, 1, 0],       // C6
  "9:m6": [X, 0, 2, 2, 1, 2],      // Am6
};

// Common slash-chord voicings, keyed by `${rootPc}:${quality}/${bassPc}`.
const SLASH: Record<string, number[]> = {
  "7:/11": [X, 2, 0, 0, 3, 3],     // G/B
  "2:/6": [2, 0, 0, 2, 3, 2],      // D/F#
  "0:/4": [0, 3, 2, 0, 1, 0],      // C/E
  "5:/9": [X, 0, 3, 2, 1, 0],      // F/A, the open x03210 shape (no barre)
  "0:/7": [3, 3, 2, 0, 1, 0],      // C/G
  "4:/8": [4, X, 2, 1, 0, 0],      // E/G#
  "9:/1": [X, 4, 2, 2, 2, 0],      // A/C#
  "9:m/7": [3, 0, 2, 2, 1, 0],     // Am/G
  "7:/6": [2, 2, 0, 0, 0, 3],      // G/F#
  "2:/9": [X, 0, 0, 2, 3, 2],      // D/A
};

// Movable templates as offsets from the root fret f; null slot = muted.
type Template = Array<number | null>;
const E_FORM: Record<string, Template> = {
  "": [0, 2, 2, 1, 0, 0],
  m: [0, 2, 2, 0, 0, 0],
  "7": [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  "5": [0, 2, 2, null, null, null],
};
const A_FORM: Record<string, Template> = {
  "": [null, 0, 2, 2, 2, 0],
  m: [null, 0, 2, 2, 1, 0],
  "7": [null, 0, 2, 0, 2, 0],
  m7: [null, 0, 2, 0, 1, 0],
  maj7: [null, 0, 2, 1, 2, 0],
  sus2: [null, 0, 2, 2, 0, null],
  sus4: [null, 0, 2, 2, 3, 0],
  "7sus4": [null, 0, 2, 0, 3, null],
  m7b5: [null, 0, 1, 0, 1, null],
  dim7: [null, 0, 1, -1, 1, null],
  aug: [null, 0, -1, -2, -2, null],
};

function fromTemplate(template: Template, rootFret: number): number[] {
  return template.map((offset) => (offset === null ? X : offset + rootFret));
}

function movableVoicing(pc: number, quality: string): number[] | null {
  const candidates: number[][] = [];
  if (E_FORM[quality]) {
    let f = mod12(pc - 4);
    const minOffset = Math.min(...E_FORM[quality].filter((o): o is number => o !== null));
    if (f + minOffset < 0) f += 12;
    candidates.push(fromTemplate(E_FORM[quality], f));
  }
  if (A_FORM[quality]) {
    let f = mod12(pc - 9);
    const minOffset = Math.min(...A_FORM[quality].filter((o): o is number => o !== null));
    if (f + minOffset < 0) f += 12;
    candidates.push(fromTemplate(A_FORM[quality], f));
  }
  if (candidates.length === 0) return null;
  // Prefer the position lower on the neck.
  candidates.sort((a, b) => Math.max(...a) - Math.max(...b));
  return candidates[0];
}

/** Alias qualities that voice identically; not counted as approximations. */
const SHAPE_ALIASES: Record<string, string> = { "2": "sus2", add2: "sus2", sus: "sus4" };

/** Progressively simpler qualities that stay "close enough" in sound. */
function simplificationLadder(quality: string): string[] {
  const out: string[] = [];
  const push = (q: string) => {
    if (!out.includes(q)) out.push(q);
  };
  push(quality);
  const family = chordFamily(quality);
  if (family === "minor") {
    if (quality !== "m7" && quality !== "m" && quality !== "m6") push("m7");
    push("m");
  } else if (family === "dominant") {
    if (quality.includes("sus")) push("7sus4");
    push("7");
    push("");
  } else if (family === "diminished") {
    push("m7b5");
    push("dim7");
    push("m");
  } else {
    if (/^maj/.test(quality)) push("maj7");
    if (/^sus/.test(quality)) push(quality === "sus2" ? "sus2" : "sus4");
    if (/^add/.test(quality)) push("add9");
    push("");
  }
  return out;
}

function toVoicing(frets: number[]): Voicing {
  const fretted = frets.filter((f) => f > 0);
  const maxFret = fretted.length > 0 ? Math.max(...fretted) : 0;
  const baseFret = maxFret <= 4 ? 1 : Math.min(...fretted);
  return { frets, baseFret };
}

/**
 * Find the diagram voicing for a displayed chord symbol.
 * Returns null only for unparseable symbols.
 */
export function voicingFor(symbol: string): ShapeResult | null {
  const parsed = parseChord(symbol);
  if (!parsed) return null;

  const normalized = SHAPE_ALIASES[parsed.quality] ?? parsed.quality;
  let bassDropped = false;

  // Slash chords: known voicing first, otherwise drop the bass.
  if (parsed.bassPc !== undefined) {
    const slash = SLASH[`${parsed.rootPc}:${normalized}/${parsed.bassPc}`];
    if (slash) {
      return {
        voicing: toVoicing(slash),
        playedAs: `${parsed.root}${parsed.quality}/${parsed.bass}`,
        approximated: false,
      };
    }
    bassDropped = true;
  }

  for (const quality of simplificationLadder(normalized)) {
    const open = OPEN[`${parsed.rootPc}:${quality}`];
    const frets = open ?? movableVoicing(parsed.rootPc, quality);
    if (frets) {
      return {
        voicing: toVoicing(frets),
        playedAs: `${parsed.root}${quality}`,
        approximated: bassDropped || quality !== normalized,
      };
    }
  }
  return null;
}
