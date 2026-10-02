import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SetSheet } from "../lib/printSet";
import { SetChartPage } from "./SetChartPage";

const sheet = (title: string, capo: number, chord: string | null, versionName?: string): SetSheet => ({
  song: {
    version: 1,
    id: title,
    title,
    lyrics: ["[Verse 1]", "Amazing grace"],
    placements: chord ? [{ id: "a", line: 1, col: 0, chord }] : [],
    keyOverride: null,
    capo,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  soundingKey: "G",
  shapedKeyName: "G",
  versionName,
});

const render = (sheets: SetSheet[]) => renderToStaticMarkup(createElement(SetChartPage, { sheets }));

describe("SetChartPage", () => {
  it("gives each song its title, capo badge, and diagrams", () => {
    const html = render([sheet("Amazing Grace", 0, "G"), sheet("It Is Well", 2, "C", "Short")]);
    expect(html.match(/class="print-chart-song"/g)).toHaveLength(2);
    expect(html).toContain("<h1>Amazing Grace</h1>");
    expect(html).toContain("<h1>It Is Well (Short)</h1>");
    expect(html.match(/print-capo/g)).toHaveLength(1);
    expect(html).toContain('<span class="print-capo">Capo 2</span>');
  });

  it("skips songs with no chords, and prints nothing when none have any", () => {
    expect(render([sheet("Amazing Grace", 0, "G"), sheet("Blank", 0, null)]).match(/print-chart-song"/g)).toHaveLength(1);
    expect(render([sheet("Blank", 0, null)])).toBe("");
  });
});
