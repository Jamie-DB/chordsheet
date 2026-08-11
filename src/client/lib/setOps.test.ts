import { describe, expect, it } from "vitest";
import type { Song } from "../../shared/types";
import { addSongToSet, createSetlist, moveInSet, pruneSetlists, removeAtFromSet } from "./setOps";

const song = (id: string): Song => ({
  version: 1,
  id,
  title: id,
  lyrics: [],
  placements: [],
  keyOverride: null,
  capo: 0,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
});

describe("setOps", () => {
  it("creates with slug ids and dedupes", () => {
    expect(createSetlist("Sunday Morning!", new Set()).id).toBe("sunday-morning");
    expect(createSetlist("Sunday Morning", new Set(["sunday-morning"])).id).toBe("sunday-morning-2");
  });

  it("appends, allowing duplicates", () => {
    let set = createSetlist("S", new Set());
    set = addSongToSet(set, "a");
    set = addSongToSet(set, "b");
    set = addSongToSet(set, "a");
    expect(set.songIds).toEqual(["a", "b", "a"]);
  });

  it("removes by index so duplicates are unambiguous", () => {
    let set = { ...createSetlist("S", new Set()), songIds: ["a", "b", "a"] };
    set = removeAtFromSet(set, 2);
    expect(set.songIds).toEqual(["a", "b"]);
    expect(removeAtFromSet(set, 9).songIds).toEqual(["a", "b"]);
  });

  it("moves within bounds and clamps at the edges", () => {
    const set = { ...createSetlist("S", new Set()), songIds: ["a", "b", "c"] };
    expect(moveInSet(set, 0, 1).songIds).toEqual(["b", "a", "c"]);
    expect(moveInSet(set, 2, 1).songIds).toEqual(["a", "b", "c"]);
    expect(moveInSet(set, 0, -1).songIds).toEqual(["a", "b", "c"]);
  });

  it("prunes ids of deleted songs", () => {
    const set = { ...createSetlist("S", new Set()), songIds: ["a", "gone", "b", "gone"] };
    const result = pruneSetlists([set], [song("a"), song("b")]);
    expect(result.changed).toBe(true);
    expect(result.sets[0].songIds).toEqual(["a", "b"]);
    expect(pruneSetlists(result.sets, [song("a"), song("b")]).changed).toBe(false);
  });
});
