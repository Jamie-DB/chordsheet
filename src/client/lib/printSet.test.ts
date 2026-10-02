import { describe, expect, it } from "vitest";
import type { Setlist, Song } from "../../shared/types";
import { setSheets } from "./printSet";

const song = (id: string, over: Partial<Song> = {}): Song => ({
  version: 1,
  id,
  title: id,
  lyrics: ["[Verse 1]", "Amazing grace", "[Chorus]", "How sweet"],
  placements: [{ id: "a", line: 1, col: 0, chord: "G" }],
  keyOverride: null,
  capo: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const set = (entries: Setlist["entries"]): Setlist => ({
  version: 1,
  id: "s",
  name: "Sunday",
  entries,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("setSheets", () => {
  it("lists the set's songs in order, repeats included, and skips missing songs", () => {
    const songs = [song("a"), song("b")];
    const sheets = setSheets(set([{ songId: "b" }, { songId: "gone" }, { songId: "a" }, { songId: "b" }]), songs);
    expect(sheets.map((s) => s.song.id)).toEqual(["b", "a", "b"]);
  });

  it("detects the key and shapes it under the capo", () => {
    const [sheet] = setSheets(set([{ songId: "a" }]), [song("a", { capo: 2 })]);
    expect(sheet.soundingKey).toBe("G");
    expect(sheet.shapedKeyName).toBe("F");
    expect(sheet.versionName).toBeUndefined();
  });

  it("prints the version the set plays, with its own chart, key, and capo", () => {
    const withVersion = song("a", {
      arrangements: [
        {
          id: "v1",
          name: "Short",
          lyrics: ["[Chorus]", "How sweet"],
          placements: [],
          keyOverride: "D",
          capo: 4,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const [sheet] = setSheets(set([{ songId: "a", arrangementId: "v1" }]), [withVersion]);
    expect(sheet.versionName).toBe("Short");
    expect(sheet.song.lyrics).toEqual(["[Chorus]", "How sweet"]);
    // The version's own key and capo, not the song's.
    expect(sheet.soundingKey).toBe("D");
    expect(sheet.shapedKeyName).toBe("Bb");
  });
});
