import { describe, expect, it } from "vitest";
import { arrangementSchema, setlistSchema, songSchema } from "./schemas";

const stamps = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };

describe("setlistSchema", () => {
  it("upgrades a legacy songIds setlist into entries", () => {
    const legacy = { version: 1, id: "demo-set", name: "Demo Set", songIds: ["amazing-grace", "it-is-well", "amazing-grace"], ...stamps };
    const parsed = setlistSchema.parse(legacy);
    expect(parsed.entries).toEqual([{ songId: "amazing-grace" }, { songId: "it-is-well" }, { songId: "amazing-grace" }]);
    expect("songIds" in parsed).toBe(false);
  });

  it("round-trips the entries format", () => {
    const set = {
      version: 1 as const,
      id: "sunday",
      name: "Sunday",
      entries: [{ songId: "it-is-well", arrangementId: "double-chorus" }, { songId: "holy-holy-holy" }],
      ...stamps,
    };
    const parsed = setlistSchema.parse(JSON.parse(JSON.stringify(set)));
    expect(parsed).toEqual(set);
    expect(setlistSchema.parse(parsed)).toEqual(set);
  });

  it("prefers entries when both fields are present", () => {
    const both = { version: 1, id: "s", name: "S", songIds: ["amazing-grace"], entries: [{ songId: "it-is-well" }], ...stamps };
    expect(setlistSchema.parse(both).entries).toEqual([{ songId: "it-is-well" }]);
  });

  it.each([
    ["no songIds or entries", { version: 1, id: "s", name: "S", ...stamps }],
    ["a non-array songIds", { version: 1, id: "s", name: "S", songIds: "amazing-grace", ...stamps }],
    ["an empty song id in legacy songIds", { version: 1, id: "s", name: "S", songIds: [""], ...stamps }],
    ["an empty arrangement id", { version: 1, id: "s", name: "S", entries: [{ songId: "a", arrangementId: "" }], ...stamps }],
    ["null", null],
    ["a string", "demo-set"],
  ])("rejects %s", (_name, raw) => {
    expect(setlistSchema.safeParse(raw).success).toBe(false);
  });
});

describe("arrangements in songs", () => {
  const arrangement = {
    id: "double-chorus",
    name: "Double chorus",
    steps: [
      { section: "", occurrence: 1 },
      { section: "[Verse 1]", occurrence: 1, mark: { kind: "soft" } },
      { section: "[Chorus]", occurrence: 1, repeat: 2, note: "build" },
      { section: "[Chorus]", occurrence: 2, mark: null, out: true },
      { section: "[Verse 4]", occurrence: 1, mark: { kind: "custom", text: "all in", color: "green" } },
    ],
    ...stamps,
  };
  const song = {
    version: 1,
    id: "it-is-well",
    title: "It Is Well with My Soul",
    lyrics: ["[Chorus]", "It is well (it is well),"],
    placements: [{ id: "p1", line: 1, col: 0, chord: "D" }],
    keyOverride: null,
    capo: 0,
    arrangements: [arrangement],
    ...stamps,
  };

  it("parses a song with arrangements unchanged", () => {
    const parsed = songSchema.parse(song);
    expect(parsed.arrangements).toEqual([arrangement]);
  });

  it("parses a song without arrangements", () => {
    const { arrangements: _drop, ...plain } = song;
    expect(songSchema.parse(plain).arrangements).toBeUndefined();
  });

  it.each([
    ["repeat 0", { section: "[Chorus]", occurrence: 1, repeat: 0 }],
    ["repeat 17", { section: "[Chorus]", occurrence: 1, repeat: 17 }],
    ["a fractional repeat", { section: "[Chorus]", occurrence: 1, repeat: 1.5 }],
    ["occurrence 0", { section: "[Chorus]", occurrence: 0 }],
    ["an unknown mark kind", { section: "[Chorus]", occurrence: 1, mark: { kind: "loud" } }],
    ["a non-boolean out", { section: "[Chorus]", occurrence: 1, out: "yes" }],
  ])("rejects a step with %s, in the song and alone", (_name, bad) => {
    const broken = { ...arrangement, steps: [bad] };
    expect(arrangementSchema.safeParse(broken).success).toBe(false);
    expect(songSchema.safeParse({ ...song, arrangements: [broken] }).success).toBe(false);
  });

  it("accepts the repeat bounds", () => {
    for (const repeat of [1, 16]) {
      expect(arrangementSchema.safeParse({ ...arrangement, steps: [{ section: "[Chorus]", occurrence: 1, repeat }] }).success).toBe(true);
    }
  });
});
