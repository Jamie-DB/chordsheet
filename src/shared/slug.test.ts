import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it.each([
    ["Amazing Grace", "amazing-grace"],
    ["Amazing Grace!", "amazing-grace"],
    ["It Is Well (with My Soul)", "it-is-well-with-my-soul"],
    ["Holy, Holy, Holy", "holy-holy-holy"],
    ["Grace's Song", "graces-song"],
    ["Grace’s Song", "graces-song"],
    ["  --Amazing Grace--  ", "amazing-grace"],
    ["", "song"],
    ["Élan", "lan"],
    ["主の祈り", "song"],
  ])("%s becomes %s", (title, slug) => {
    expect(slugify(title, new Set())).toBe(slug);
  });

  it("appends the first free numeric suffix when the id is taken", () => {
    expect(slugify("Amazing Grace", new Set(["amazing-grace"]))).toBe("amazing-grace-2");
    expect(slugify("Amazing Grace", new Set(["amazing-grace", "amazing-grace-2"]))).toBe("amazing-grace-3");
    expect(slugify("", new Set(["song"]))).toBe("song-2");
  });
});
