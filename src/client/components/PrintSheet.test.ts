import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Song } from "../../shared/types";
import { PrintSheet } from "./PrintSheet";

const song = (lyrics: string[], placements: Song["placements"] = []): Song => ({
  version: 1,
  id: "t",
  title: "Amazing Grace",
  lyrics,
  placements,
  keyOverride: null,
  capo: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const render = (s: Song) =>
  renderToStaticMarkup(createElement(PrintSheet, { song: s, soundingKey: "G", shapedKeyName: "G" }));

const LONG = "Amazing grace, how sweet the sound that saved a wretch";

describe("PrintSheet keeps section titles with their first row", () => {
  it("wraps a two-column compact label with the line after it", () => {
    const html = render(song(["[Verse 1]", "Amazing grace", "That saved a wretch", "[Verse 2]", "I once was lost"]));
    expect(html.match(/class="print-keep"/g)).toHaveLength(2);
    expect(html).toMatch(/<div class="print-keep"><div class="print-pair print-label-compact">.*?Verse 1.*?Amazing grace/);
    expect(html).toMatch(/<div class="print-keep"><div class="print-pair print-label-compact">.*?Verse 2.*?I once was lost/);
    // Lines after the first stay outside the block so the section can still break.
    expect(html).toContain('Amazing grace</pre></div></div><div class="print-pair"><pre class="print-lyric">That saved a wretch');
  });

  it("keeps chords placed on a label line with the title and first line", () => {
    const html = render(song(["[Verse 1]", "Amazing grace"], [{ id: "a", line: 0, col: 0, chord: "G" }]));
    expect(html).toMatch(/<div class="print-keep"><div class="print-pair"><pre class="print-chords">G<\/pre><\/div><div class="print-pair print-label-compact">.*?Verse 1.*?Amazing grace/);
  });

  it("keeps a sidebar label row with chords together with the first line", () => {
    const html = render(song(["[Verse 1]", LONG], [{ id: "a", line: 0, col: 0, chord: "G" }]));
    expect(html).toMatch(/<div class="print-keep"><div class="print-pair"><span class="print-side-label">Verse 1<\/span>.*?<\/div><div class="print-pair">.*?Amazing grace/);
  });

  it("does not wrap a sidebar title that already rides its first line", () => {
    const html = render(song(["[Verse 1]", LONG]));
    expect(html).not.toContain("print-keep");
    expect(html).toMatch(/print-side-label">Verse 1<\/span>/);
  });

  it("keeps an empty section's label with the next section's first line", () => {
    const html = render(song(["[Intro]", "[Verse 1]", "Amazing grace"]));
    expect(html.match(/class="print-keep"/g)).toHaveLength(1);
    expect(html).toMatch(/print-keep">.*?Intro.*?Verse 1.*?Amazing grace/);
  });

  it("prints a trailing label on its own when nothing follows it", () => {
    const html = render(song(["Amazing grace", "[Outro]"]));
    expect(html).not.toContain("print-keep");
    expect(html).toContain("Outro");
  });
});
