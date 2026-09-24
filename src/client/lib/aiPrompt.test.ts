import { describe, expect, it } from "vitest";
import type { Song } from "../../shared/types";
import { buildAiPrompt } from "./aiPrompt";

// Public domain: Amazing Grace.
const song: Song = {
  version: 1,
  id: "amazing-grace",
  title: "Amazing Grace",
  lyrics: ["[Verse 1]", "Amazing grace, how sweet the sound"],
  placements: [{ id: "p1", line: 1, col: 0, chord: "G" }],
  keyOverride: null,
  capo: 0,
  arrangements: [
    {
      id: "sep-24-version",
      name: "Sep 24 version",
      steps: [{ section: "[Verse 1]", occurrence: 1, repeat: 2 }],
      createdAt: "2026-09-24T00:00:00.000Z",
      updatedAt: "2026-09-24T00:00:00.000Z",
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function promptJson(prompt: string): Record<string, unknown> {
  return JSON.parse(prompt.slice(prompt.indexOf("My song JSON:") + "My song JSON:".length)) as Record<string, unknown>;
}

describe("buildAiPrompt", () => {
  it("leaves versions out of the JSON handed to the AI", () => {
    const prompt = buildAiPrompt(song);
    expect(prompt).not.toContain("arrangements");
    expect(prompt).not.toContain("Sep 24 version");
    const json = promptJson(prompt);
    expect(json.lyrics).toEqual(song.lyrics);
    expect(json.placements).toEqual(song.placements);
  });

  it("does not modify the song it is given", () => {
    buildAiPrompt(song);
    expect(song.arrangements).toHaveLength(1);
  });
});
