import { describe, expect, it } from "vitest";
import type { Song } from "../../shared/types";
import { ensurePermission, syncSongs, type DirHandleLike } from "./diskSync";

const song = (id: string): Song => ({
  version: 1,
  id,
  title: id,
  lyrics: ["la line"],
  placements: [],
  keyOverride: null,
  capo: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

function fakeDir(initial: Record<string, string> = {}): {
  dir: DirHandleLike;
  files: Record<string, string>;
  writes: string[];
} {
  const files: Record<string, string> = { ...initial };
  const writes: string[] = [];
  const dir: DirHandleLike = {
    name: "songs",
    getFileHandle: (name, opts) => {
      if (!(name in files) && !opts?.create) return Promise.reject(new Error("NotFound"));
      return Promise.resolve({
        getFile: () => Promise.resolve({ text: () => Promise.resolve(files[name]) }),
        createWritable: () =>
          Promise.resolve({
            write: (data: string) => {
              files[name] = data;
              writes.push(name);
              return Promise.resolve();
            },
            close: () => Promise.resolve(),
          }),
      });
    },
  };
  return { dir, files, writes };
}

describe("syncSongs", () => {
  it("writes one pretty JSON file per song", async () => {
    const { dir, files } = fakeDir();
    const result = await syncSongs([song("one"), song("two")], dir);
    expect(result).toEqual({ written: 2, skipped: 0 });
    expect(Object.keys(files).sort()).toEqual(["one.json", "two.json"]);
    expect(JSON.parse(files["one.json"]).id).toBe("one");
    expect(files["one.json"].endsWith("\n")).toBe(true);
  });

  it("checks disk first and skips files whose content already matches", async () => {
    const first = fakeDir();
    await syncSongs([song("one"), song("two")], first.dir);
    const again = await syncSongs([song("one"), song("two")], first.dir);
    expect(again).toEqual({ written: 0, skipped: 2 });
    expect(first.writes).toEqual(["one.json", "two.json"]);
  });

  it("rewrites only files that changed", async () => {
    const { dir, writes } = fakeDir();
    const a = song("one");
    await syncSongs([a, song("two")], dir);
    const edited = { ...a, title: "Renamed" };
    const result = await syncSongs([edited, song("two")], dir);
    expect(result).toEqual({ written: 1, skipped: 1 });
    expect(writes.filter((w) => w === "one.json")).toHaveLength(2);
    expect(writes.filter((w) => w === "two.json")).toHaveLength(1);
  });
});

describe("ensurePermission", () => {
  it("passes handles without a permission API", async () => {
    expect(await ensurePermission(fakeDir().dir)).toBe(true);
  });
  it("asks only when the state is prompt", async () => {
    const asked: string[] = [];
    const handle: DirHandleLike = {
      ...fakeDir().dir,
      queryPermission: () => Promise.resolve("prompt"),
      requestPermission: (d) => {
        asked.push(d.mode);
        return Promise.resolve("granted");
      },
    };
    expect(await ensurePermission(handle)).toBe(true);
    expect(asked).toEqual(["readwrite"]);
  });
  it("reports denial", async () => {
    const handle: DirHandleLike = {
      ...fakeDir().dir,
      queryPermission: () => Promise.resolve("denied"),
    };
    expect(await ensurePermission(handle)).toBe(false);
  });
});
