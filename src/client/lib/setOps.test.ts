import { describe, expect, it } from "vitest";
import type { SetEntry, Setlist, Song } from "../../shared/types";
import {
  addSongToSet,
  createSetlist,
  moveInSet,
  pruneSetlists,
  removeAtFromSet,
  setEntryArrangement,
} from "./setOps";

const song = (id: string, arrangementIds: string[] = []): Song => ({
  version: 1,
  id,
  title: id,
  lyrics: [],
  placements: [],
  keyOverride: null,
  capo: 0,
  ...(arrangementIds.length > 0
    ? {
        arrangements: arrangementIds.map((a) => ({
          id: a,
          name: a,
          steps: [],
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        })),
      }
    : {}),
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
});

const withEntries = (...entries: SetEntry[]): Setlist => ({
  ...createSetlist("S", new Set()),
  updatedAt: "2026-01-01",
  entries,
});
const ids = (set: Setlist) => set.entries.map((e) => e.songId);

describe("setOps", () => {
  it("creates empty with slug ids and dedupes", () => {
    expect(createSetlist("Sunday Morning!", new Set()).id).toBe("sunday-morning");
    expect(createSetlist("Sunday Morning", new Set(["sunday-morning"])).id).toBe("sunday-morning-2");
    expect(createSetlist("  ", new Set()).name).toBe("Untitled set");
    expect(createSetlist("S", new Set()).entries).toEqual([]);
  });

  it("appends, allowing duplicates, with an optional arrangement", () => {
    let set = createSetlist("S", new Set());
    set = addSongToSet(set, "a");
    set = addSongToSet(set, "b", "double-chorus");
    set = addSongToSet(set, "a");
    expect(set.entries).toEqual([{ songId: "a" }, { songId: "b", arrangementId: "double-chorus" }, { songId: "a" }]);
    expect(addSongToSet(set, "c", "").entries[3]).toEqual({ songId: "c" });
  });

  it("removes by index so duplicates are unambiguous", () => {
    let set = withEntries({ songId: "a" }, { songId: "b" }, { songId: "a", arrangementId: "x" });
    set = removeAtFromSet(set, 2);
    expect(set.entries).toEqual([{ songId: "a" }, { songId: "b" }]);
    expect(removeAtFromSet(set, 9)).toBe(set);
    expect(removeAtFromSet(set, -1)).toBe(set);
  });

  it("moves within bounds and clamps at the edges, carrying the arrangement", () => {
    const set = withEntries({ songId: "a", arrangementId: "x" }, { songId: "b" }, { songId: "c" });
    expect(moveInSet(set, 0, 1).entries).toEqual([{ songId: "b" }, { songId: "a", arrangementId: "x" }, { songId: "c" }]);
    expect(moveInSet(set, 2, 1)).toBe(set);
    expect(moveInSet(set, 0, -1)).toBe(set);
    expect(ids(moveInSet(set, 2, -2))).toEqual(["c", "a", "b"]);
  });

  describe("setEntryArrangement", () => {
    const set = withEntries({ songId: "a" }, { songId: "a", arrangementId: "x" }, { songId: "b" });
    it.each<[string, number, string | undefined, SetEntry[]]>([
      ["sets a version on one entry only", 0, "long", [{ songId: "a", arrangementId: "long" }, { songId: "a", arrangementId: "x" }, { songId: "b" }]],
      ["replaces a version", 1, "long", [{ songId: "a" }, { songId: "a", arrangementId: "long" }, { songId: "b" }]],
      ["undefined returns to the song as written", 1, undefined, [{ songId: "a" }, { songId: "a" }, { songId: "b" }]],
      ["an empty id returns to the song as written", 1, "", [{ songId: "a" }, { songId: "a" }, { songId: "b" }]],
    ])("%s", (_name, index, arrangementId, expected) => {
      const next = setEntryArrangement(set, index, arrangementId);
      expect(next.entries).toEqual(expected);
      expect(next.updatedAt).not.toBe("2026-01-01");
      expect("arrangementId" in next.entries[index]).toBe(Boolean(arrangementId));
    });
    it("ignores out of range indices", () => {
      expect(setEntryArrangement(set, -1, "x")).toBe(set);
      expect(setEntryArrangement(set, 3, "x")).toBe(set);
    });
  });

  it("prunes entries of deleted songs", () => {
    const set = withEntries({ songId: "a" }, { songId: "gone" }, { songId: "b" }, { songId: "gone", arrangementId: "x" });
    const result = pruneSetlists([set], [song("a"), song("b")]);
    expect(result.changed).toBe(true);
    expect(result.sets[0].entries).toEqual([{ songId: "a" }, { songId: "b" }]);
    expect(pruneSetlists(result.sets, [song("a"), song("b")]).changed).toBe(false);
  });

  it("drops a dangling arrangement back to the plain song entry, keeping live ones", () => {
    const set = withEntries(
      { songId: "a", arrangementId: "deleted" },
      { songId: "a", arrangementId: "kept" },
      { songId: "b", arrangementId: "never" },
      { songId: "b" },
    );
    const songs = [song("a", ["kept"]), song("b")];
    const result = pruneSetlists([set], songs);
    expect(result.changed).toBe(true);
    expect(result.sets[0].entries).toEqual([
      { songId: "a" },
      { songId: "a", arrangementId: "kept" },
      { songId: "b" },
      { songId: "b" },
    ]);
    expect(pruneSetlists(result.sets, songs).changed).toBe(false);
  });

  it("returns untouched sets by identity and reports no change", () => {
    const clean = withEntries({ songId: "a", arrangementId: "kept" });
    const dirty = withEntries({ songId: "gone" });
    const result = pruneSetlists([clean, dirty], [song("a", ["kept"])]);
    expect(result.sets[0]).toBe(clean);
    expect(result.sets[1].entries).toEqual([]);
    const none = pruneSetlists([clean], [song("a", ["kept"])]);
    expect(none.changed).toBe(false);
    expect(none.sets[0]).toBe(clean);
  });
});
