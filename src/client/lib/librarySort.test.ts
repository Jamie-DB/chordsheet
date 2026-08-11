import { describe, expect, it } from "vitest";
import type { Song } from "../../shared/types";
import { DEFAULT_SORT, SORTS, isSortKey, matchesQuery } from "./librarySort";

const song = (id: string, title: string, artist?: string, updatedAt = "2026-01-01", createdAt = "2026-01-01"): Song => ({
  version: 1,
  id,
  title,
  artist,
  lyrics: [],
  placements: [],
  keyOverride: null,
  capo: 0,
  createdAt,
  updatedAt,
});

describe("matchesQuery", () => {
  const s = song("a", "Amazing Grace", "John Newton");
  it("matches title and artist case-insensitively", () => {
    expect(matchesQuery(s, "amaz")).toBe(true);
    expect(matchesQuery(s, "NEWTON")).toBe(true);
    expect(matchesQuery(s, "  grace ")).toBe(true);
  });
  it("does not match lyrics or absence", () => {
    expect(matchesQuery(s, "wretch")).toBe(false);
    expect(matchesQuery(song("b", "Untitled"), "newton")).toBe(false);
  });
  it("empty query matches everything", () => {
    expect(matchesQuery(s, "")).toBe(true);
    expect(matchesQuery(s, "   ")).toBe(true);
  });
});

describe("SORTS", () => {
  const list = [
    song("c", "banana song", "Zed", "2026-03-01", "2026-01-03"),
    song("a", "Apple Song", "Amy", "2026-01-01", "2026-01-01"),
    song("b", "Cherry Song", undefined, "2026-02-01", "2026-01-02"),
  ];
  it("defaults to title and sorts case-insensitively", () => {
    expect(DEFAULT_SORT).toBe("title");
    expect([...list].sort(SORTS.title.compare).map((s) => s.id)).toEqual(["a", "c", "b"]);
  });
  it("artist sort puts artistless songs last, ties broken by title", () => {
    expect([...list].sort(SORTS.artist.compare).map((s) => s.id)).toEqual(["a", "c", "b"]);
  });
  it("updated and created sort newest first", () => {
    expect([...list].sort(SORTS.updated.compare).map((s) => s.id)).toEqual(["c", "b", "a"]);
    expect([...list].sort(SORTS.created.compare).map((s) => s.id)).toEqual(["c", "b", "a"]);
  });
});

describe("isSortKey", () => {
  it("guards stored preferences", () => {
    expect(isSortKey("title")).toBe(true);
    expect(isSortKey("bogus")).toBe(false);
    expect(isSortKey(undefined)).toBe(false);
  });
});
