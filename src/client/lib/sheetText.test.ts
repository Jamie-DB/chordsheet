import { describe, expect, it } from "vitest";
import type { Song } from "../../shared/types";
import { headerKeyLine, printFooterCss, sheetText } from "./sheetText";
import { transposeSong } from "./songOps";

const song: Song = {
  version: 1,
  id: "t",
  title: "Test",
  artist: "Trad.",
  lyrics: ["Amazing grace, how sweet the sound", "no chords here"],
  placements: [
    { id: "1", line: 0, col: 0, chord: "G" },
    { id: "2", line: 0, col: 19, chord: "C" },
  ],
  keyOverride: null,
  capo: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("printFooterCss", () => {
  it("puts the title bottom left and the page count bottom right", () => {
    const css = printFooterCss("Amazing Grace");
    expect(css).toContain('@bottom-left { content: "Amazing Grace"; }');
    expect(css).toContain('@bottom-right { content: "Page " counter(page) " of " counter(pages); }');
  });

  it("adds a version name in parentheses and ignores a blank one", () => {
    expect(printFooterCss("Amazing Grace", " Acoustic ")).toContain('content: "Amazing Grace (Acoustic)";');
    expect(printFooterCss("Amazing Grace", "  ")).toContain('content: "Amazing Grace";');
  });

  it("escapes quotes and backslashes and flattens line breaks", () => {
    expect(printFooterCss('Say "Hi" \\ Bye\nNow')).toContain('content: "Say \\"Hi\\" \\\\ Bye Now";');
  });
});

describe("headerKeyLine", () => {
  it("joins the sounding key and capo", () => {
    expect(headerKeyLine("Eb", 3)).toBe("Key: Eb, Capo 3");
    expect(headerKeyLine("G", 0)).toBe("Key: G");
    expect(headerKeyLine(null, 2)).toBe("Capo 2");
    expect(headerKeyLine(null, 0)).toBe("");
  });
});

describe("sheetText", () => {
  it("interleaves header, chord rows, and lyrics", () => {
    expect(sheetText(song, "G", "G")).toBe(
      [
        "Test",
        "Trad.",
        "Key: G",
        "",
        "G" + " ".repeat(18) + "C",
        "Amazing grace, how sweet the sound",
        "no chords here",
        "",
      ].join("\n"),
    );
  });

  it("puts a version name on its own line after the title and artist", () => {
    const lines = sheetText(song, "G", "G", "Sep 24 version").split("\n");
    expect(lines.slice(0, 4)).toEqual(["Test", "Trad.", "Sep 24 version", "Key: G"]);
    const noArtist = sheetText({ ...song, artist: undefined }, "G", "G", "Sep 24 version").split("\n");
    expect(noArtist.slice(0, 3)).toEqual(["Test", "Sep 24 version", "Key: G"]);
  });

  it("leaves out a blank version name", () => {
    expect(sheetText(song, "G", "G", "  ")).toBe(sheetText(song, "G", "G"));
  });

  it("renders capo shapes and header capo", () => {
    const capoed = { ...song, capo: 3 };
    const text = sheetText(capoed, "G", "E");
    expect(text).toContain("Key: G, Capo 3");
    expect(text).toContain("E" + " ".repeat(18) + "A");
  });

  it("wraps hold chords as <C> with the bracket borrowing a column", () => {
    const held = {
      ...song,
      placements: [
        { id: "1", line: 0, col: 0, chord: "G", hold: true },
        { id: "2", line: 0, col: 19, chord: "C", hold: true },
      ],
    };
    const text = sheetText(held, "G", "G");
    expect(text).toContain("<G>" + " ".repeat(15) + "<C>");
  });
});

describe("transposeSong", () => {
  it("moves chords and override together", () => {
    const up = transposeSong({ ...song, keyOverride: "G" }, "G", 2);
    expect(up.placements.map((p) => p.chord)).toEqual(["A", "D"]);
    expect(up.keyOverride).toBe("A");
    expect(up.capo).toBe(song.capo);
  });
  it("spells for the destination key", () => {
    const down = transposeSong(song, "G", -2);
    expect(down.placements.map((p) => p.chord)).toEqual(["F", "Bb"]);
  });
});
