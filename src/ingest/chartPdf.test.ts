import { describe, expect, it } from "vitest";
import { songSchema } from "../shared/schemas";
import { ingestChart, parseBboxHtml, slugify, type WordBox } from "./chartPdf";

// Synthetic word boxes in the chart layout, built from the demo set only.
const CW = 5; // points per lyric character
const BODY = 10.055;
const SMALL = 7.54;
const LEFT = 70;
const RIGHT = 330;

function box(x: number, y: number, text: string, h = BODY, width = text.length * CW, page = 0): WordBox {
  return { page, pageWidth: 612, xMin: x, yMin: y, xMax: x + width, yMax: y + h, text };
}

/** A lyric line: words advance by character cells from x0. */
function lyric(y: number, text: string, x0 = LEFT, page = 0): WordBox[] {
  const out: WordBox[] = [];
  let col = 0;
  for (const w of text.split(" ")) {
    out.push(box(x0 + col * CW, y, w, BODY, w.length * CW, page));
    col += w.length + 1;
  }
  return out;
}

/** A chord over character cell `col` of the lyric row at `y`. */
const chordAt = (y: number, col: number, text: string, x0 = LEFT, page = 0) =>
  box(x0 + col * CW, y - 11.35, text, BODY, text.length * CW, page);

function label(y: number, bubble: string, name: string, x0 = LEFT, page = 0): WordBox[] {
  const words = name.split(" ");
  return [
    box(x0 + 6, y + 1.4, bubble, SMALL, 5, page),
    ...words.map((w, i) => box(x0 + 22 + i * 45, y, w, 10.89, 40, page)),
  ];
}

const note = (y: number, text: string, x0 = LEFT) =>
  text.split(" ").map((w, i) => box(x0 + 120 + i * 30, y, w, 9.22, 28));

const header = (key = "G"): WordBox[] => [
  ...["Amazing", "Grace"].map((w, i) => box(LEFT + i * 60, 59, w, 17.2, 55)),
  ...["John", "Newton"].map((w, i) => box(LEFT + i * 30, 81, w, 8.0, 25)),
  box(430, 81, "Key:", SMALL, 15),
  box(447, 81, key, SMALL, 5),
  box(464, 81, "Tempo:", SMALL, 27),
  box(493, 81, "72.50", SMALL, 12),
  box(514, 81, "Time:", SMALL, 20),
  box(536, 81, "3/4", SMALL, 11),
  box(LEFT + 7, 106, "V1", SMALL, 9), // roadmap bubble
];

const ingest = (words: WordBox[], key?: string) => ingestChart(words, { key, now: "2026-01-01T00:00:00.000Z" });
const chordsOn = (r: ReturnType<typeof ingest>, line: number) =>
  r.song.placements.filter((p) => p.line === line).map((p) => [p.col, p.chord]);

describe("parseBboxHtml", () => {
  it("reads pages, boxes, and entities", () => {
    const html =
      '<doc><page width="612.000000" height="792.000000">' +
      '<word xMin="1.5" yMin="2" xMax="3" yMax="4">wretch&apos;s</word></page>' +
      '<page width="600.000000" height="792.000000"><word xMin="5" yMin="6" xMax="7" yMax="8">a&amp;b</word></page></doc>';
    expect(parseBboxHtml(html)).toEqual([
      { page: 0, pageWidth: 612, xMin: 1.5, yMin: 2, xMax: 3, yMax: 4, text: "wretch's" },
      { page: 1, pageWidth: 600, xMin: 5, yMin: 6, xMax: 7, yMax: 8, text: "a&b" },
    ]);
  });

  it("returns nothing for a PDF with no text layer", () => {
    expect(parseBboxHtml('<doc><page width="612" height="792"></page></doc>')).toEqual([]);
  });
});

describe("slugify", () => {
  it.each([
    ["Amazing Grace", "amazing-grace"],
    ["It Is Well (with My Soul)", "it-is-well-with-my-soul"],
    ["Grace's Song", "graces-song"],
  ])("%s", (title, slug) => expect(slugify(title)).toBe(slug));
});

describe("ingestChart", () => {
  it("reads header metadata and produces a schema-valid song", () => {
    const r = ingest([
      ...header(),
      ...label(140, "V1", "VERSE 1"),
      ...note(155, "Soft piano only"),
      chordAt(180, 0, "G"),
      chordAt(180, 19, "C"),
      ...lyric(180, "Amazing grace, how sweet the sound"),
      box(420, 732, "Writers:", 6.3, 20, 1),
      box(442, 732, "John", 6.3, 15, 1),
      box(459, 732, "Newton", 6.3, 20, 1),
    ]);
    expect(() => songSchema.parse(r.song)).not.toThrow();
    expect(r.song).toMatchObject({
      id: "amazing-grace",
      title: "Amazing Grace",
      artist: "John Newton",
      keyOverride: "G",
      bpm: 73,
      capo: 0,
      lyrics: ["[Verse 1]", "Amazing grace, how sweet the sound"],
      sectionMarks: [{ section: "[Verse 1]", occurrence: 1, kind: "soft", text: "Soft piano only" }],
    });
    expect(r.song.notes).toBe("Ingested from a PDF chart. 3/4, tempo 72.50.\nWriters: John Newton. As recorded by John Newton.");
    expect(chordsOn(r, 1)).toEqual([[0, "G"], [19, "C"]]);
  });

  it("maps chord x to a cell: word start, inside a word, in a gap, left of an indent, past the end", () => {
    const words = lyric(180, "That saved a wretch like me", LEFT + 3 * CW);
    // Widen the gap before "like" the way charts do to fit a chord over a rest.
    for (const w of words.slice(4)) {
      w.xMin += 20;
      w.xMax += 20;
    }
    const r = ingest([
      ...header(),
      ...label(140, "V1", "VERSE 1"),
      box(LEFT, 180 - 11.35, "G"), // left of the indented line
      chordAt(180, 5, "C", LEFT + 3 * CW), // start of "saved"
      chordAt(180, 16, "D", LEFT + 3 * CW), // "wretch" cell 3
      box(LEFT + 3 * CW + 19 * CW + 8, 180 - 11.35, "G"), // in the widened gap before "like"
      box(LEFT + 3 * CW + 27 * CW + 20 + 30, 180 - 11.35, "C"), // well past "me"
      ...words,
    ]);
    expect(chordsOn(r, 1)).toEqual([[0, "G"], [5, "C"], [16, "D"], [19, "G"], [29, "C"]]);
    expect(r.log).toContain("line 1: C sits past the end of the lyric");
  });

  it("packs several chords that sit before an indented lyric", () => {
    const r = ingest([
      ...header(),
      ...label(140, "V1", "VERSE 1"),
      box(LEFT, 180 - 11.35, "G"),
      box(LEFT + 14, 180 - 11.35, "Em", BODY, 14),
      box(LEFT + 40, 180 - 11.35, "C"),
      ...lyric(180, "Was blind, but now I see", LEFT + 60),
    ]);
    expect(chordsOn(r, 1)).toEqual([[0, "G"], [2, "Em"], [5, "C"]]);
  });

  it("turns a chord row with no lyric under it into an instrumental line", () => {
    const r = ingest([
      ...header(),
      ...label(140, "I", "INTRO"),
      box(LEFT, 170, "G"),
      box(LEFT + 36, 170, "C"),
      box(LEFT + 52, 170, "G"),
      ...label(220, "V1", "VERSE 1"),
      ...lyric(260, "Was blind, but now I see"),
    ]);
    expect(r.song.lyrics).toEqual(["[Intro]", "", "", "[Verse 1]", "Was blind, but now I see"]);
    expect(chordsOn(r, 1)).toEqual([[0, "G"], [6, "C"], [9, "G"]]);
  });

  it.each([
    // [case, chord row boxes, key, expected symbols, expected log fragment]
    ["superscript joins its chord", [box(LEFT, 170, "D"), box(LEFT + 7.4, 169, "6", SMALL, 4.2), box(LEFT + 11.3, 170, "/A", BODY, 10.8)], "D", ["D6/A"], null],
    ["suffix after a gap had an accidental", [box(LEFT, 170, "F", BODY, 5.45), box(LEFT + 10.8, 170, "m", BODY, 9.7), box(LEFT + 21, 169, "7", SMALL, 4.2)], "D", ["F#m7"], "accidental restored from gap: F to F#"],
    ["lone chord wider than its glyphs had an accidental", [box(LEFT, 170, "Fm", BODY, 20.5)], "D", ["F#m"], "accidental restored from width: Fm to F#m"],
    ["lone chord at its natural width is left alone", [box(LEFT, 170, "Bm", BODY, 16.6)], "D", ["Bm"], null],
    ["bare slash bass follows the key signature", [box(LEFT, 170, "D/F", BODY, 16.8)], "D", ["D/F#"], "bass accidental restored from key: D/F to D/F#"],
    ["bass outside the key signature stays natural", [box(LEFT, 170, "D/A", BODY, 18.2)], "D", ["D/A"], null],
    ["flat keys restore flats and warn", [box(LEFT, 170, "Gm/B", BODY, 27)], "F", ["Gm/Bb"], "flat key F: flat glyphs leave no trace, they are restored from the key signature, check every chord"],
    ["flat keys restore a bare root", [box(LEFT, 170, "F", BODY, 5.45), box(LEFT + 14, 170, "B", BODY, 6.9)], "F", ["F", "Bb"], "root accidental restored from key: B to Bb"],
    ["sharp keys only flag a bare altered root", [box(LEFT, 170, "G", BODY, 7.4)], "A", ["G"], "bare G kept natural, the chart may print G#: check it"],
    ["slash inside a quality is rewritten", [box(LEFT, 170, "D"), box(LEFT + 7.4, 169, "6/9", SMALL, 11), box(LEFT + 18.2, 170, "/A", BODY, 10.8)], "D", ["D69/A"], "rewritten for the chord grammar: D6/9/A to D69/A"],
    ["superscript 1 is dropped", [box(LEFT, 170, "A", BODY, 6.85), box(LEFT + 6.9, 169, "1", SMALL, 4.2)], "D", ["A"], "superscript 1 dropped from A"],
    ["two separate chords stay separate", [box(LEFT, 170, "G", BODY, 7), box(LEFT + 15.5, 170, "C", BODY, 6.4)], "G", ["G", "C"], null],
  ] as const)("chord assembly: %s", (_name, row, key, symbols, logged) => {
    const r = ingest([...header(), ...label(140, "I", "INTRO"), ...row], key);
    expect(r.song.placements.map((p) => p.chord)).toEqual(symbols);
    if (logged) expect(r.log).toContain(logged);
    else expect(r.log).toEqual([]);
  });

  it("reads left column, then right column, then the next page, and lets a section continue across them", () => {
    const r = ingest([
      ...header(),
      ...label(140, "V1", "VERSE 1"),
      ...lyric(180, "Amazing grace, how sweet the sound"),
      chordAt(180, 25, "D", RIGHT),
      ...lyric(180, "That saved a wretch like me", RIGHT),
      box(LEFT, 57, "Amazing Grace", 10.89, 60, 1), // running title
      box(515, 57, "Page:", SMALL, 20, 1),
      ...lyric(126, "I once was lost, but now am found", LEFT, 1),
      ...label(160, "V2", "VERSE 2", RIGHT, 1),
      ...lyric(200, "Was blind, but now I see", RIGHT, 1),
      box(132, 740, "footer", 5.9, 30, 1),
    ]);
    expect(r.song.lyrics).toEqual([
      "[Verse 1]",
      "Amazing grace, how sweet the sound",
      "That saved a wretch like me",
      "I once was lost, but now am found",
      "",
      "[Verse 2]",
      "Was blind, but now I see",
    ]);
    expect(chordsOn(r, 2)).toEqual([[25, "D"]]);
  });

  it("joins stacked notes and counts label occurrences for marks", () => {
    const r = ingest([
      ...header(),
      ...label(140, "C", "CHORUS"),
      ...lyric(180, "Amazing grace"),
      ...label(220, "C", "CHORUS"),
      ...note(235, "Full band in"),
      ...note(247, "Build"),
      ...lyric(280, "Amazing grace"),
    ]);
    expect(r.song.sectionMarks).toEqual([{ section: "[Chorus]", occurrence: 2, kind: "build", text: "Full band in, Build" }]);
  });

  it("straightens curly apostrophes and lets the key option win over the header", () => {
    const r = ingest([...header("B"), ...label(140, "V1", "VERSE 1"), ...lyric(180, "Grace’s sound")], "Bb");
    expect(r.song.lyrics[1]).toBe("Grace's sound");
    expect(r.song.keyOverride).toBe("Bb");
  });

  it("logs a missing key and leaves keyOverride null", () => {
    const r = ingest([...label(140, "V1", "VERSE 1"), ...lyric(180, "Amazing grace")]);
    expect(r.song.keyOverride).toBeNull();
    expect(r.log).toEqual(["no key found in the header: bass accidentals were not restored"]);
  });
});
