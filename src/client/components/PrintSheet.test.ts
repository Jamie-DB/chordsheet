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
    expect(html).toMatch(/<div class="print-keep"><div class="print-pair[^"]* print-label-compact[^"]*">.*?Verse 1.*?Amazing grace/);
    expect(html).toMatch(/<div class="print-keep"><div class="print-pair[^"]* print-label-compact[^"]*">.*?Verse 2.*?I once was lost/);
    // Lines after the first stay outside the block so the section can still break.
    expect(html).toMatch(/Amazing grace<\/pre><\/div><\/div><div class="print-pair[^"]*"><pre class="print-lyric">That saved a wretch/);
  });

  it("keeps chords placed on a label line with the title and first line", () => {
    const html = render(song(["[Verse 1]", "Amazing grace"], [{ id: "a", line: 0, col: 0, chord: "G" }]));
    expect(html).toMatch(/<div class="print-keep"><div class="print-pair[^"]*"><pre class="print-chords">G<\/pre><\/div><div class="print-pair[^"]* print-label-compact[^"]*">.*?Verse 1.*?Amazing grace/);
  });

  it("keeps a sidebar label row with chords together with the first line", () => {
    const html = render(song(["[Verse 1]", LONG], [{ id: "a", line: 0, col: 0, chord: "G" }]));
    expect(html).toMatch(/<div class="print-keep"><div class="print-pair[^"]*"><span class="print-side-label">Verse 1<\/span>.*?<\/div><div class="print-pair[^"]*">.*?Amazing grace/);
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

describe("PrintSheet section type bars", () => {
  it("gives every row of a section its type's bar, label row included", () => {
    const html = render(song(["[Verse 1]", "Amazing grace", "[Chorus]", "How sweet the sound"]));
    expect(html).toMatch(/class="print-pair sec-verse print-label-compact section-start"><pre class="print-lyric">Verse 1/);
    expect(html).toMatch(/class="print-pair sec-verse"><pre class="print-lyric">Amazing grace/);
    expect(html).toMatch(/class="print-pair sec-chorus print-label-compact section-start"><pre class="print-lyric">Chorus/);
    expect(html).toMatch(/class="print-pair sec-chorus"><pre class="print-lyric">How sweet the sound/);
  });

  it("leaves rows before the first label without a bar", () => {
    const html = render(song(["Amazing grace", "[Verse 1]", "How sweet the sound"]));
    expect(html).toMatch(/class="print-pair"><pre class="print-lyric">Amazing grace/);
  });

  it("prints dynamics as neutral notes", () => {
    const s = song(["[Chorus]", "Amazing grace"]);
    s.sectionMarks = [{ section: "[Chorus]", occurrence: 1, kind: "soft" }];
    const html = render(s);
    expect(html).toContain('<span class="print-mark-name">  SOFT</span>');
    expect(html).not.toMatch(/name-(red|blue|amber|green)/);
  });
});

describe("PrintSheet header", () => {
  it("prints only the title and a key, capo, and tempo tagline", () => {
    const s = { ...song(["[Verse 1]", "Amazing grace"]), artist: "John Newton", notes: "Chorus after every verse.", capo: 2, bpm: 72 };
    const html = renderToStaticMarkup(
      createElement(PrintSheet, { song: s, soundingKey: "G", shapedKeyName: "F", versionName: "Short" }),
    );
    expect(html).toContain('<div class="print-header"><h1>Amazing Grace</h1><span class="print-key">Key: G, Capo 2, 72 BPM</span></div>');
    expect(html).not.toContain("John Newton");
    expect(html).not.toContain("Chorus after every verse.");
    expect(html).not.toMatch(/<div class="print-version">/);
  });
});

describe("PrintSheet repeat badge", () => {
  it("splits a trailing xN off the title into a badge", () => {
    const html = render(song(["[Chorus x2]", "Amazing grace"]));
    expect(html).toContain('Chorus <span class="print-repeat">↻ x2</span>');
  });

  it("badges sections merged from back-to-back repeats", () => {
    const html = render(song(["[Chorus]", "Amazing grace", "[Chorus]", "Amazing grace", "[Chorus]", "Amazing grace"]));
    expect(html).toContain('<span class="print-repeat">↻ x3</span>');
  });

  it("badges sidebar titles too", () => {
    const html = render(song(["[Verse 1 x2]", LONG]));
    expect(html).toContain('<span class="print-side-label">Verse 1 <span class="print-repeat">↻ x2</span></span>');
  });

  it("leaves single sections and x-words alone", () => {
    const html = render(song(["[Chorus]", "Amazing grace", "[Verse x]", "How sweet"]));
    expect(html).not.toContain("print-repeat");
    expect(html).toContain("Verse x");
  });
});

describe("PrintSheet pass lines", () => {
  it("prints each pass of a merged repeat on its own line with an ordinal badge", () => {
    const s = song(["[Chorus]", "Amazing grace", "[Chorus]", "Amazing grace"]);
    s.sectionMarks = [
      { section: "[Chorus]", occurrence: 1, kind: "soft" },
      { section: "[Chorus]", occurrence: 2, kind: "custom", text: "Add snare" },
    ];
    const html = render(s);
    expect(html).toContain('<span class="print-repeat">↻ x2</span>');
    expect(html).toContain('<span class="print-pass"><span class="print-pass-num">1st</span> SOFT</span>');
    expect(html).toContain('<span class="print-pass"><span class="print-pass-num">2nd</span> ADD SNARE</span>');
  });
});
