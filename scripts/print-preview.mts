/**
 * Render a song, one of its versions, or a whole set exactly as it prints and
 * write one PNG per page, so a print change can be looked at without a
 * browser dialog. Uses the real print components and print.css, headless
 * Chrome for the PDF, and pdftoppm for the pages.
 *
 *   npm run print-preview -- <song.json> [--version <id>] [--no-diagrams]
 *   npm run print-preview -- --set <setId> --dir <library folder> [--no-diagrams]
 *
 * Pages land in a temp folder (or --out), never in the repo. Needs Chrome
 * (CHROME=/path to override the macOS default) and pdftoppm (poppler).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrintSheet } from "../src/client/components/PrintSheet";
import { SetPrint } from "../src/client/components/SetPrint";
import { chartOf } from "../src/client/lib/charts";
import { cleanSong } from "../src/client/lib/cleanSong";
import { detectKey, shapedKey } from "../src/engine";
import { setlistSchema, songSchema } from "../src/shared/schemas";
import type { Song } from "../src/shared/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const showDiagrams = !flag("no-diagrams");
const out = resolve(option("out") ?? join(tmpdir(), "chordsheet-print-preview"));
mkdirSync(out, { recursive: true });

const loadSong = (path: string): Song => cleanSong(songSchema.parse(JSON.parse(readFileSync(path, "utf8")))).song;

let body: string;
const setId = option("set");
if (setId !== undefined) {
  const dir = option("dir");
  if (!dir) throw new Error("--set needs --dir <library folder>");
  const songs = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "setlists.json")
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    .filter((raw) => Array.isArray(raw.lyrics))
    .map((raw) => cleanSong(songSchema.parse(raw)).song);
  const { setlists } = JSON.parse(readFileSync(join(dir, "setlists.json"), "utf8")) as { setlists: unknown[] };
  const set = setlists.map((s) => setlistSchema.parse(s)).find((s) => s.id === setId);
  if (!set) throw new Error(`No set "${setId}" in ${dir}/setlists.json`);
  body = renderToStaticMarkup(createElement(SetPrint, { set, songs, showDiagrams }));
} else {
  const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--version" && args[args.indexOf(a) - 1] !== "--out");
  if (!file) throw new Error("Give a song.json, or --set <id> --dir <folder>");
  const written = loadSong(file);
  const versionId = option("version");
  const chart = chartOf(written, versionId);
  const soundingKey = chart.keyOverride ?? detectKey(chart.placements.map((p) => p.chord))?.name ?? null;
  body = renderToStaticMarkup(
    createElement(PrintSheet, {
      song: chart,
      soundingKey,
      shapedKeyName: soundingKey ? shapedKey(soundingKey, chart.capo) : "C",
      versionName: versionId ? written.arrangements?.find((a) => a.id === versionId)?.name : undefined,
      showDiagrams,
    }),
  );
}

const css = ["app.css", "print.css"].map((f) => readFileSync(join(root, "src/client/styles", f), "utf8")).join("\n");
const html = join(out, "preview.html");
const pdf = join(out, "preview.pdf");
writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>${css}</style><body>${body}`);

const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${pdf}`, html], { stdio: "ignore" });
execFileSync("pdftoppm", ["-r", "60", "-png", pdf, join(out, "page")]);
const pages = readdirSync(out).filter((f) => /^page-\d+\.png$/.test(f)).sort();
console.log(`${pages.length} page(s) in ${out}`);
for (const page of pages) console.log(join(out, page));
