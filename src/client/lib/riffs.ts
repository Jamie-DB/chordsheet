import { isChordSymbol, isStaffLine, shiftTab } from "../../engine";
import type { Chart, ChordPlacement, Riff } from "../../shared/types";

/** A cue's text: the riff's name, with " x2" when it plays more than once. */
export function cueText(name: string, times = 1): string {
  return times > 1 ? `${name} x${times}` : name;
}

/** The riff a placement's text names and how many times it plays; null for a chord. */
export function parseCue(text: string, riffs: Riff[] | undefined): { riff: Riff; times: number } | null {
  if (!riffs || riffs.length === 0) return null;
  const m = /^(.*?)(?:\s+x(\d{1,2}))?$/i.exec(text.trim());
  if (!m) return null;
  const name = m[1].trim().toLowerCase();
  const riff = riffs.find((r) => r.name.toLowerCase() === name);
  if (!riff) return null;
  return { riff, times: m[2] ? Math.max(1, Number(m[2])) : 1 };
}

export function isCue(p: ChordPlacement, riffs: Riff[] | undefined): boolean {
  return parseCue(p.chord, riffs) !== null;
}

/** The chart's chord symbols with riff cues left out, for key detection and capo math. */
export function chordSymbols(chart: Pick<Chart, "placements" | "riffs">): string[] {
  return chart.placements.filter((p) => !isCue(p, chart.riffs)).map((p) => p.chord);
}

/** "Riff A", then B, C, and on, skipping names already taken. */
export function nextRiffName(riffs: Riff[] | undefined): string {
  const taken = new Set((riffs ?? []).map((r) => r.name.toLowerCase()));
  for (let i = 0; i < 26; i++) {
    const name = `Riff ${String.fromCharCode(65 + i)}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
  return `Riff ${taken.size + 1}`;
}

/** Why a riff name cannot be used, or null when it can. */
export function riffNameProblem(name: string, riffs: Riff[] | undefined, ownId?: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Give the riff a name.";
  if (isChordSymbol(trimmed)) return `"${trimmed}" reads as a chord. Try "Riff ${trimmed}".`;
  if (/\sx\d+$/i.test(trimmed)) return "A name cannot end in a repeat count like x2.";
  const clash = (riffs ?? []).some((r) => r.id !== ownId && r.name.toLowerCase() === trimmed.toLowerCase());
  return clash ? `There is already a riff called "${trimmed}".` : null;
}

/** Rename a riff and every cue that names it, keeping each cue's repeat count. */
export function renameRiff<T extends Chart>(chart: T, id: string, name: string): T {
  const riffs = chart.riffs ?? [];
  const placements = chart.placements.map((p) => {
    const cue = parseCue(p.chord, riffs);
    return cue && cue.riff.id === id ? { ...p, chord: cueText(name, cue.times) } : p;
  });
  return { ...chart, placements, riffs: riffs.map((r) => (r.id === id ? { ...r, name } : r)) };
}

/** Remove a riff and its cues. */
export function removeRiff<T extends Chart>(chart: T, id: string): T {
  const riffs = chart.riffs ?? [];
  const placements = chart.placements.filter((p) => parseCue(p.chord, riffs)?.riff.id !== id);
  const rest = riffs.filter((r) => r.id !== id);
  return { ...chart, placements, riffs: rest.length > 0 ? rest : undefined };
}

/** Pasted tab as lines: tabs expanded, trailing space trimmed, blank edges dropped. */
export function cleanTab(text: string): string[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\t/g, "    ").replace(/\s+$/, ""));
  while (lines.length > 0 && lines[0] === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Tab as the hands play it under the capo (stored tab is sounding, capo 0). */
export function tabAsShape(tab: string[], capo: number): string[] {
  return shiftTab(tab, -capo);
}

/** Tab typed while a capo is on, moved up to the sounding frets it is stored as. */
export function tabFromShape(tab: string[], capo: number): string[] {
  return shiftTab(tab, capo);
}

export type RiffDraft = Omit<Riff, "id">;

/**
 * Split pasted text into riffs. A text line before a staff heads a riff as
 * "Name | hint | ref" (hint and ref optional). Staves with no text line
 * between them belong to one riff, so a long line that wraps stays whole.
 * A riff with no heading comes back unnamed.
 */
export function parseRiffPaste(text: string): RiffDraft[] {
  const out: RiffDraft[] = [];
  let current: RiffDraft | null = null;
  let seenStaff = false;
  for (const line of cleanTab(text)) {
    if (isStaffLine(line)) {
      if (!current) current = { name: "", tab: [] };
      current.tab.push(line);
      seenStaff = true;
    } else if (line.trim() === "") {
      if (current && seenStaff) current.tab.push("");
    } else {
      if (current && seenStaff) out.push(current);
      const [name, hint, ref] = line.split(/\s+\|\s+/).map((s) => s.trim());
      current = {
        name: name.replace(/:$/, ""),
        tab: [],
        ...(hint ? { hint } : {}),
        ...(ref ? { ref } : {}),
      };
      seenStaff = false;
    }
  }
  if (current && seenStaff) out.push(current);
  return out.map((r) => ({ ...r, tab: cleanTab(r.tab.join("\n")) }));
}

/** Delay times for a tempo, in whole milliseconds. */
export function delayTimes(bpm: number): { dottedEighth: number; quarter: number; eighth: number } {
  const quarter = 60000 / bpm;
  return {
    dottedEighth: Math.round(quarter * 0.75),
    quarter: Math.round(quarter),
    eighth: Math.round(quarter / 2),
  };
}
