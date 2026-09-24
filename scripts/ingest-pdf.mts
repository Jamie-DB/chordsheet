/**
 * Text-layer chord chart PDF to a song JSON file, outside the repo.
 * Prints the chord-over-lyric preview and every correction made, so the
 * result can be proofread against the chart before import.
 *
 * Run with: npm run ingest-pdf -- <chart.pdf> [outDir] [--key Bb] [--force] [--dry-run]
 * The app's Import PDF button runs the same reader and ingest in the browser.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ingestChart } from "../src/ingest/chartPdf";
import { readPdfWords } from "../src/ingest/readPdf";
import { groupLog, previewLines } from "../src/ingest/review";
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

const words = await readPdfWords(new Uint8Array(readFileSync(pdf)));
if (words.length === 0) {
  console.error("no text layer found: this PDF is a scan, use the screenshot round trip in docs/AI-PLACEMENT.md");
  process.exit(1);
}

const { song, log } = ingestChart(words, { key });
songSchema.parse(song);

for (const line of previewLines(song)) console.log(line);
console.log("\nsection marks:");
for (const m of song.sectionMarks ?? []) console.log(`  ${m.section} #${m.occurrence}: ${m.kind}${m.text ? ` "${m.text}"` : ""}`);
console.log("\ncorrections and judgment calls:");
for (const { entry, count } of groupLog(log)) console.log(`  ${entry}${count > 1 ? ` (x${count})` : ""}`);
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
