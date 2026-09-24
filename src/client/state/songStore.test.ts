import { describe, expect, it } from "vitest";
import type { Arrangement, Setlist, Song } from "../../shared/types";
import { reducer, type AppState } from "./songStore";

const version = (id: string): Arrangement => ({
  id,
  name: id,
  steps: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const song = (id: string, arrangements?: Arrangement[]): Song => ({
  version: 1,
  id,
  title: id,
  lyrics: [],
  placements: [],
  keyOverride: null,
  capo: 0,
  ...(arrangements ? { arrangements } : {}),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const WELL = song("it-is-well", [version("sep-24"), version("easter")]);
const GRACE = song("amazing-grace");

const SET: Setlist = {
  version: 1,
  id: "sunday",
  name: "Sunday",
  entries: [{ songId: "amazing-grace" }, { songId: "it-is-well", arrangementId: "sep-24" }, { songId: "it-is-well" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const state = (): AppState => ({ songs: [GRACE, WELL], setlists: [SET], view: { name: "set", id: "sunday" } });

describe("openInSet", () => {
  it("passes the entry's version to the editor view", () => {
    expect(reducer(state(), { type: "openInSet", setId: "sunday", setIndex: 1 }).view).toEqual({
      name: "editor",
      id: "it-is-well",
      setId: "sunday",
      setIndex: 1,
      arrangementId: "sep-24",
    });
  });

  it("leaves the version out for an entry played as written", () => {
    expect(reducer(state(), { type: "openInSet", setId: "sunday", setIndex: 2 }).view).toEqual({
      name: "editor",
      id: "it-is-well",
      setId: "sunday",
      setIndex: 2,
    });
  });

  it("ignores an index past the end", () => {
    const s = state();
    expect(reducer(s, { type: "openInSet", setId: "sunday", setIndex: 3 })).toBe(s);
  });
});

describe("replaceSong", () => {
  it("drops a deleted version from set entries, falling back to as written", () => {
    const next = reducer(state(), { type: "replaceSong", song: { ...WELL, arrangements: [version("easter")] } });
    expect(next.setlists[0].entries).toEqual([
      { songId: "amazing-grace" },
      { songId: "it-is-well" },
      { songId: "it-is-well" },
    ]);
  });

  it("keeps the same setlists array when no entry changes", () => {
    const s = state();
    const next = reducer(s, { type: "replaceSong", song: { ...WELL, title: "It Is Well with My Soul" } });
    expect(next.setlists).toBe(s.setlists);
    expect(next.songs.find((x) => x.id === "it-is-well")?.title).toBe("It Is Well with My Soul");
  });
});

describe("setEntryArrangement", () => {
  it("sets and clears the version of one entry", () => {
    let s = reducer(state(), { type: "setEntryArrangement", setId: "sunday", index: 2, arrangementId: "easter" });
    expect(s.setlists[0].entries[2]).toEqual({ songId: "it-is-well", arrangementId: "easter" });
    s = reducer(s, { type: "setEntryArrangement", setId: "sunday", index: 1 });
    expect(s.setlists[0].entries[1]).toEqual({ songId: "it-is-well" });
  });
});
