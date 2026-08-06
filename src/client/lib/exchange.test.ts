import { describe, expect, it } from "vitest";
import type { Song } from "../../shared/types";
import { parseImport, songToJson } from "./exchange";
import { lyricsFromPaste, slugify } from "./storage";

const song: Song = {
  version: 1,
  id: "test-song",
  title: "Test Song",
  lyrics: ["Amazing grace, how sweet the sound", "That saved a wretch like me"],
  placements: [{ id: "p1", line: 0, col: 0, chord: "G" }],
  keyOverride: null,
  capo: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("parseImport", () => {
  it("round-trips an exported song", () => {
    const result = parseImport(songToJson(song));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.song).toEqual(song);
      expect(result.unresolved).toEqual([]);
    }
  });

  it("rejects invalid JSON with a readable error", () => {
    const result = parseImport("{not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/JSON/);
  });

  it("rejects schema violations with a path", () => {
    const bad = JSON.parse(songToJson(song)) as Record<string, unknown>;
    bad.capo = 15;
    const result = parseImport(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("capo");
  });

  it("resolves anchor-form placements to columns", () => {
    const imported = {
      ...song,
      placements: [
        { line: 0, chord: "C", anchor: "sweet" },
        { line: 1, chord: "D", anchor: "me", anchorOccurrence: 1, offsetInAnchor: 0 },
      ],
    };
    const result = parseImport(JSON.stringify(imported));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.song.placements.map((p) => ({ line: p.line, col: p.col, chord: p.chord }))).toEqual([
        { line: 0, col: song.lyrics[0].indexOf("sweet"), chord: "C" },
        { line: 1, col: song.lyrics[1].indexOf("me"), chord: "D" },
      ]);
    }
  });

  it("surfaces unresolvable anchors instead of dropping them", () => {
    const imported = { ...song, placements: [{ line: 0, chord: "C", anchor: "banana" }] };
    const result = parseImport(JSON.stringify(imported));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.song.placements).toEqual([]);
      expect(result.unresolved).toHaveLength(1);
      expect(result.unresolved[0].chord).toBe("C");
    }
  });

  it("reports out-of-range lines as unresolved", () => {
    const imported = { ...song, placements: [{ line: 99, col: 0, chord: "C" }] };
    const result = parseImport(JSON.stringify(imported));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.unresolved[0].reason).toContain("line 99");
  });

  it("keeps past-end columns, bounding only absurd values", () => {
    const imported = {
      ...song,
      placements: [
        { line: 1, col: 40, chord: "D" },
        { line: 1, col: 5000, chord: "E" },
      ],
    };
    const result = parseImport(JSON.stringify(imported));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.song.placements[0].col).toBe(40);
      expect(result.song.placements[1].col).toBe(200);
    }
  });

  it("rejects lyric changes for an existing song, keeping library lyrics", () => {
    const tampered = { ...song, lyrics: ["Different words entirely", "That saved a wretch like me"] };
    const result = parseImport(JSON.stringify(tampered), song);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lyricsRejected).toBe(true);
      expect(result.song.lyrics).toEqual(song.lyrics);
    }
  });

  it("assigns fresh ids to imported placements that lack one", () => {
    const imported = { ...song, placements: [{ line: 0, col: 3, chord: "Em" }] };
    const result = parseImport(JSON.stringify(imported));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.song.placements[0].id).toBeTruthy();
  });
});

describe("library backup files", () => {
  it("round-trips a library", async () => {
    const { libraryToJson, parseLibraryFile } = await import("./exchange");
    const other = { ...song, id: "second", title: "Second" };
    const parsed = parseLibraryFile(libraryToJson([song, other]));
    expect(parsed).not.toBeNull();
    expect(parsed!.songs.map((s) => s.id)).toEqual(["test-song", "second"]);
    expect(parsed!.invalid).toBe(0);
  });

  it("counts invalid entries instead of absorbing them", async () => {
    const { parseLibraryFile } = await import("./exchange");
    const parsed = parseLibraryFile(JSON.stringify({ chordsheetLibrary: 1, songs: [song, { junk: true }] }));
    expect(parsed!.songs).toHaveLength(1);
    expect(parsed!.invalid).toBe(1);
  });

  it("returns null for non-library JSON so single-song import handles it", async () => {
    const { parseLibraryFile, songToJson: toJson } = await import("./exchange");
    expect(parseLibraryFile(toJson(song))).toBeNull();
    expect(parseLibraryFile("{not json")).toBeNull();
    expect(parseLibraryFile("[1,2]")).toBeNull();
  });
});

describe("slugify", () => {
  it("slugs and dedupes", () => {
    expect(slugify("Amazing Grace!", new Set())).toBe("amazing-grace");
    expect(slugify("Amazing Grace", new Set(["amazing-grace"]))).toBe("amazing-grace-2");
    expect(slugify("", new Set())).toBe("song");
  });
});

describe("lyricsFromPaste", () => {
  it("normalizes newlines, tabs, and trailing whitespace", () => {
    expect(lyricsFromPaste("a\r\nb\tc  \r\n\nd")).toEqual(["a", "b    c", "", "d"]);
  });
});
