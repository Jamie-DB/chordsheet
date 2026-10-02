import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Song } from "../../shared/types";
import { Editor } from "./Editor";

const song: Song = {
  version: 1,
  id: "amazing-grace",
  title: "Amazing Grace",
  lyrics: ["[Verse 1]", "Amazing grace", "", "[Chorus]", "How sweet the sound"],
  placements: [{ id: "a", line: 1, col: 0, chord: "G" }],
  keyOverride: "G",
  capo: 0,
  arrangements: [
    {
      id: "short",
      name: "Short",
      lyrics: ["[Chorus x2]", "How sweet the sound", "That saved a wretch"],
      placements: [{ id: "b", line: 1, col: 0, chord: "C" }],
      keyOverride: "C",
      capo: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const render = (initialArrangementId?: string) =>
  renderToStaticMarkup(createElement(Editor, { song, initialArrangementId, onBack() {}, onChange() {} }));

describe("Editor", () => {
  it("shows the song as written like any other version, in the version picker and the order strip", () => {
    const html = render();
    expect(html).toContain("<option value=\"\" selected=\"\">As written</option>");
    expect(html).toContain("Order of As written");
    expect(html).toContain("Amazing grace");
    expect(html).not.toContain("That saved a wretch");
  });

  it("opens a version on its own words, chords, key, and capo, with the same editing tools", () => {
    const html = render("short");
    expect(html).toContain("Order of Short");
    expect(html).toContain("That saved a wretch");
    expect(html).not.toContain("Amazing grace");
    expect(html).toContain("Capo 3");
    // The line editing hint and the Edit lyrics button are there, not a read-only note.
    expect(html).toContain("Edit lyrics");
    expect(html).toContain("Double-click a line to edit its words");
    expect(html).not.toContain("edited in As written");
  });
});
