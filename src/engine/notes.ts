export type Spelling = "sharp" | "flat";

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C" -> 0, "F#" -> 6, "Bb" -> 10. Null for anything that is not a note name. */
export function noteToPc(name: string): number | null {
  const m = /^([A-G])(#|b)?$/.exec(name);
  if (!m) return null;
  let pc = LETTER_PC[m[1]];
  if (m[2] === "#") pc += 1;
  if (m[2] === "b") pc -= 1;
  return ((pc % 12) + 12) % 12;
}

export function pcToName(pc: number, prefer: Spelling): string {
  const idx = ((pc % 12) + 12) % 12;
  return prefer === "flat" ? FLAT_NAMES[idx] : SHARP_NAMES[idx];
}

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}
