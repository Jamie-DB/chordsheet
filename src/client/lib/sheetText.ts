import { buildChordRow, displayChord, positionLabel } from "../../engine";
import type { Riff, Song } from "../../shared/types";
import { delayTimes, tabAsShape } from "./riffs";

/**
 * The header's key line, e.g. "Key: Eb, Capo 3". The key shown is always the
 * sounding key. Empty when there is neither a key nor a capo.
 */
export function headerKeyLine(soundingKey: string | null, capo: number): string {
  const bits: string[] = [];
  if (soundingKey) bits.push(`Key: ${soundingKey}`);
  if (capo > 0) bits.push(`Capo ${capo}`);
  return bits.join(", ");
}

/**
 * The printed sheet's tagline beside the title, e.g. "Key: Eb, 72 BPM". The
 * capo is left out because the sheet shows it as its own highlighted badge.
 * Tempo shows only when the song sets one.
 */
export function printTagline(soundingKey: string | null, bpm?: number): string {
  return [soundingKey ? `Key: ${soundingKey}` : "", bpm ? `${bpm} BPM` : ""].filter(Boolean).join(", ");
}

/** The capo badge text, or null when the song plays open. */
export function capoBadge(capo: number): string | null {
  return capo > 0 ? `Capo ${capo}` : null;
}

/**
 * The @page rule that puts the song name on the left of every printed page's
 * footer and "Page 1 of 3" on the right, so loose pages sort back into songs
 * and order. The name is embedded as a CSS string, since margin boxes cannot
 * read it from the DOM.
 */
export function printFooterCss(title: string, versionName?: string): string {
  const name = versionName?.trim() ? `${title.trim()} (${versionName.trim()})` : title.trim();
  return (
    "@page {" +
    ` @bottom-left { content: ${cssString(name)}; }` +
    ` @bottom-right { content: "Page " counter(page) " of " counter(pages); }` +
    " }"
  );
}

/** A CSS string literal; line breaks collapse to spaces. */
function cssString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s*[\r\n]+\s*/g, " ")}"`;
}

/**
 * Plain-text rendering of the sheet. Chord and lyric rows match print because
 * both come from buildChordRow, but section labels stay as bracketed lyric
 * lines, holds render as <C>, and dynamics marks and chord diagrams are left out.
 * A version's name gets its own line under the title and artist.
 */
export function sheetText(
  song: Song,
  soundingKey: string | null,
  shapedKeyName: string,
  versionName?: string,
): string {
  const out: string[] = [song.title];
  if (song.artist) out.push(song.artist);
  if (versionName?.trim()) out.push(versionName.trim());
  const keyLine = headerKeyLine(soundingKey, song.capo);
  if (keyLine) out.push(keyLine);
  if (song.notes?.trim()) out.push(...song.notes.trim().split("\n"));
  const tone = toneLine(song.tone, song.bpm, (song.riffs ?? []).length > 0);
  if (tone) out.push(tone);
  out.push("");

  song.lyrics.forEach((line, i) => {
    // Holds print as <C>, the ASCII form of the diamond; the opening bracket
    // borrows the column to the left so the chord letter stays put.
    const linePlacements = song.placements
      .filter((p) => p.line === i)
      .map((p) => (p.hold ? { ...p, col: Math.max(0, p.col - 1) } : p));
    const row = buildChordRow(linePlacements, (chord, hold) => {
      const display = displayChord(chord, song.capo, shapedKeyName);
      return hold ? `<${display}>` : display;
    });
    if (row.length > 0) out.push(row);
    out.push(line);
  });
  for (const riff of song.riffs ?? []) {
    const shown = tabAsShape(riff.tab, song.capo);
    out.push("", riffHeading(riff, shown), ...shown);
  }
  return out.join("\n") + "\n";
}

/**
 * The tone strip's text: the dotted-eighth delay time when the chart sets a
 * tempo, then the tone in words. Only an electric chart (one with a tone or
 * riffs) gets one, so a plain chord chart prints as before.
 */
export function toneLine(tone: string | undefined, bpm: number | undefined, hasRiffs: boolean): string {
  if (!tone?.trim() && !hasRiffs) return "";
  const bits: string[] = [];
  if (bpm) bits.push(`Delay dotted 8th ${delayTimes(bpm).dottedEighth} ms`);
  if (tone?.trim()) bits.push(tone.trim());
  return bits.length > 0 ? `Tone: ${bits.join(". ")}` : "";
}

/** "Riff A · fret 5 · ref 0:42 · hint", from the tab as the hands play it. */
export function riffHeading(riff: Riff, shown: string[]): string {
  return [riff.name, positionLabel(shown), riff.ref && `ref ${riff.ref}`, riff.hint].filter(Boolean).join(" · ");
}
