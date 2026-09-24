/**
 * Text-layer chord chart PDF to a song JSON file, outside the repo.
 * Prints the chord-over-lyric preview and every correction made, so the
 * result can be proofread against the chart before import.
 *
 * Run with: npm run ingest-pdf -- <chart.pdf> [outDir] [--key Bb] [--force] [--dry-run]
 * Needs poppler's pdftotext on PATH (brew install poppler).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildChordRow } from "../src/engine/layout";
import { ingestChart, parseBboxHtml } from "../src/ingest/chartPdf";
import { songSchema } from "../src/shared/schemas";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const keyAt = args.indexOf("--key");
const key = keyAt >= 0 ? args[keyAt + 1] : undefined;
const positional = args.filter((a, i) => !a.startsWith("--") && (keyAt < 0 || i !== keyAt + 1));
const [pdf, outDirArg] = positional;
if (!pdf) {
  console.error("usage: npm run ingest-pdf -- <chart.pdf> [outDir] [--key Bb] [--force] [--dry-run]");
  process.exit(2);
}

const outDir = resolve(outDirArg ?? join(homedir(), "Documents", "chordsheet-library"));
// Ingested charts are usually copyrighted; they never land inside the repo.
if (!relative(REPO, outDir).startsWith("..")) {
  console.error(`refusing to write inside the repo: ${outDir}`);
  process.exit(2);
}

const html = execFileSync("pdftotext", ["-bbox", pdf, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const words = parseBboxHtml(html);
if (words.length === 0) {
  console.error("no text layer found: this PDF is a scan, use the screenshot round trip in docs/AI-PLACEMENT.md");
  process.exit(1);
}

const { song, log } = ingestChart(words, { key });
songSchema.parse(song);

song.lyrics.forEach((line, i) => {
  const here = song.placements.filter((p) => p.line === i);
  if (here.length > 0) console.log("    " + buildChordRow(here));
  console.log(String(i).padStart(3) + " " + line);
});
console.log("\nsection marks:");
for (const m of song.sectionMarks ?? []) console.log(`  ${m.section} #${m.occurrence}: ${m.kind}${m.text ? ` "${m.text}"` : ""}`);
console.log("\ncorrections and judgment calls:");
const counts = new Map<string, number>();
for (const entry of log) counts.set(entry, (counts.get(entry) ?? 0) + 1);
for (const [entry, n] of counts) console.log(`  ${entry}${n > 1 ? ` (x${n})` : ""}`);
console.log(`\n${song.title}: key ${song.keyOverride}, ${song.lyrics.length} lines, ${song.placements.length} placements`);
console.log("chords:", [...new Set(song.placements.map((p) => p.chord))].sort().join(" "));

const out = join(outDir, `${song.id}.json`);
if (flag("--dry-run")) {
  console.log(`dry run, nothing written (would be ${out})`);
} else if (existsSync(out) && !flag("--force")) {
  console.error(`\n${out} exists, pass --force to overwrite`);
  process.exit(1);
} else {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(out, JSON.stringify(song, null, 2) + "\n");
  console.log(`wrote ${out}`);
}
