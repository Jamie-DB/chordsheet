import { describe, expect, it } from "vitest";
import type { Arrangement, Song } from "../../shared/types";
import {
  defaultVersionName,
  entryTitle,
  findArrangement,
  versionCount,
} from "./versions";

const version = (id: string, name: string): Arrangement => ({
  id,
  name,
  lyrics: [],
  placements: [],
  keyOverride: null,
  capo: 0,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
});

const song = (id: string, title: string, arrangements?: Arrangement[]): Song => ({
  version: 1,
  id,
  title,
  lyrics: [],
  placements: [],
  keyOverride: null,
  capo: 0,
  ...(arrangements ? { arrangements } : {}),
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
});

const WELL = song("it-is-well", "It Is Well with My Soul", [version("aug-23", "Aug 23 version")]);
const GRACE = song("amazing-grace", "Amazing Grace");

describe("defaultVersionName", () => {
  it.each<[Date, string]>([
    [new Date(2026, 8, 24), "Sep 24 version"],
    [new Date(2026, 0, 1), "Jan 1 version"],
    [new Date(2026, 11, 31, 23, 59), "Dec 31 version"],
    [new Date(2026, 7, 3), "Aug 3 version"],
  ])("%s is %j", (date, expected) => {
    expect(defaultVersionName(date)).toBe(expected);
  });
});

describe("findArrangement", () => {
  it.each<[string, Song, string | null | undefined, string | null]>([
    ["finds by id", WELL, "aug-23", "aug-23"],
    ["null id is as written", WELL, null, null],
    ["undefined id is as written", WELL, undefined, null],
    ["an unknown id is as written", WELL, "gone", null],
    ["a song without versions", GRACE, "aug-23", null],
  ])("%s", (_name, s, id, expected) => {
    expect(findArrangement(s, id)?.id ?? null).toBe(expected);
  });
});

describe("entryTitle", () => {
  const songs = [WELL, GRACE];
  it.each<[string, Parameters<typeof entryTitle>[1], string | null]>([
    ["no entry", undefined, null],
    ["as written", { songId: "amazing-grace" }, "Amazing Grace"],
    ["with a version", { songId: "it-is-well", arrangementId: "aug-23" }, "It Is Well with My Soul (Aug 23 version)"],
    ["a deleted version falls back to the title", { songId: "it-is-well", arrangementId: "gone" }, "It Is Well with My Soul"],
    ["a missing song", { songId: "holy-holy-holy" }, null],
  ])("%s", (_name, entry, expected) => {
    expect(entryTitle(songs, entry)).toBe(expected);
  });
});

describe("versionCount", () => {
  it.each<[number, string]>([
    [1, "1 version"],
    [2, "2 versions"],
    [0, "0 versions"],
  ])("%i", (n, expected) => {
    expect(versionCount(n)).toBe(expected);
  });
});
