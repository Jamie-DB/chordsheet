# chordsheet design

The contract all phases and roadmap issues are cut from. See CLAUDE.md for invariants and conventions.

## Problem

Asking an AI to produce a chord-over-lyrics sheet directly hits copyright refusals because of the lyric text. This tool sidesteps that: Jamie pastes the lyrics and controls placement. When AI helps at all, it only ever outputs functional data (chord symbols, line indices, short anchor substrings quoted from Jamie's own pasted text), never lyric content.

## v1 scope

Static SPA (Vite + React 19 + TS + Vitest + zod). No server, no API keys. Print-first output. Manual placement editor, capo and transpose controls, key detection, JSON export/import, and an export-to-Claude-Code round trip for screenshot-based placement.

## Data model

```ts
interface ChordPlacement {
  id: string;
  line: number;
  col: number;
  chord: string;         // canonical SOUNDING symbol, e.g. "Bbmaj7", "G/B", "F#m7"
  hold?: boolean;        // full-measure hold, drawn as a diamond
}

interface Song {
  version: 1;
  id: string;            // slug; export filename <id>.json
  title: string;
  artist?: string;
  lyrics: string[];      // lines verbatim from paste; tabs expanded, trailing whitespace trimmed
  placements: ChordPlacement[];
  keyOverride: string | null;   // "Eb", "Cm", ...; null = auto-detect
  capo: number;          // 0-9
  bpm?: number;          // auto-scroll tempo; absent = 80
  notes?: string;        // free text under the header
  sectionMarks?: SectionMark[];
  arrangements?: Arrangement[];   // named playing versions, see Arrangements
  createdAt: string;     // ISO 8601
  updatedAt: string;
}

interface SectionMark {
  section: string;       // label line text, e.g. "[Verse 1]"
  occurrence: number;    // which of the identical labels, 1-based
  kind: "tacet" | "soft" | "build" | "full" | "custom";
  text?: string;         // custom word shown in place of the preset name
  color?: "red" | "blue" | "amber" | "green";   // custom marks only
}

interface Arrangement {
  id: string;            // slug, unique within the song
  name: string;          // "Aug 23 version"
  steps: ArrangementStep[];
  createdAt: string;
  updatedAt: string;
}

interface ArrangementStep {
  section: string;       // label line text, or "" for unlabeled lines above the first label
  occurrence: number;    // same anchor as SectionMark
  repeat?: number;       // 2-16, printed once as "Chorus x2"; absent = once
  note?: string;         // cue printed under the label
  mark?: { kind; text?; color? } | null;   // overrides the section's mark; null clears it
}

interface Setlist {
  version: 1;
  id: string;            // slug from the name
  name: string;
  entries: { songId: string; arrangementId?: string }[];   // ordered; repeats allowed
  createdAt: string;
  updatedAt: string;
}
```

Import additionally accepts placements in anchor form `{line, chord, anchor, anchorOccurrence?, offsetInAnchor?}` (no col, no id). The tool resolves anchors to columns deterministically because models miscount character offsets but quote substrings reliably.

## Chord engine (src/engine/, pure TS, zero deps)

- `notes.ts` pitch-class math; sharp and flat spelling tables.
- `chord.ts` `parseChord` / `isChordSymbol` / `formatChord`. Root `[A-G](#|b)?`, normalized quality set (m, 7, maj7, m7, m7b5, dim, dim7, aug, sus2, sus4, 7sus4, 6, m6, 9, m9, add9, 11, 13, 5), optional slash bass. Unknown suffixes preserved verbatim as opaque quality; transpose still works on root and bass.
- `transpose.ts` `transposeSymbol(symbol, semitones, prefer)`.
- `key.ts` `detectKey(symbols)` scores all 24 keys: diatonic triad match +3, root-in-scale +1, first and last chord tonic +3 each, dominant present +1. Also `keyPrefersFlat`, `transposeKeyName`.
- `capo.ts` `displayChord`, `shapedKey` (key minus capo), `soundingFromShape` (entry while capo > 0), `suggestCapo` (frets 0-9 ranked by open-shape friendliness: open majors and 7ths of C A G E D plus B7 score +3, open minors Am Em Dm +3, barre-only roots -1, weighted by occurrence count, with ties broken toward the lower fret).
- `layout.ts` `buildChordRow` (print and export row builder: chords padded to their columns, collisions shifted right keeping one space between symbols) and `resolveAnchor` (nth-occurrence substring search: exact, then case-insensitive, then the nth occurrence of the first word, where an offset past that word is dropped).

## Paste ingestion (src/client/lib/tabPaste.ts)

Song creation runs the pasted text through `parsePastedTab`. A line whose every whitespace-separated token parses as a chord symbol is a chord line: its tokens become placements at their exact columns on the following lyric line, and the chord line leaves the lyrics array. Chord lines with no lyric line beneath them (intros, instrumentals, stacked rows) attach to an inserted empty line so they still print as standalone rows. A "Written for capo" selector on the create form covers tabs written for a capo: symbols are read as shapes at that fret, transposed up to sounding for storage, and the song starts with that capo set, so the sheet initially shows exactly what was pasted and later capo moves never change the song. Known false positive: a lyric line consisting of a single note-name word ("A"); one click fixes it.

Section spacing is normalized everywhere (src/client/lib/normalize.ts): runs of blank lines collapse to exactly one, leading and trailing blanks are stripped, and placement line indices remap. Blank lines carrying placements (standalone instrumental rows) are content and never collapse. Applied on paste, on lyric save, on new-song import, and as a load-time migration that fixes and re-saves songs already in the library.

## Storage and exchange

- localStorage key `chordsheet.songs.v1` holds the library and `chordsheet.setlists.v1` the sets. Autosave debounced 800 ms. Last-write-wins across tabs (accepted limitation).
- Per-song "Export" in the library downloads `<id>.json`, pretty-printed. "Save all to folder" writes every song plus `setlists.json` into a folder picked once, and "Download backup" saves everything as one `chordsheet-library.json`. Jamie keeps the private library outside the repo (`~/Documents/chordsheet-library/`). `songs/` in the repo carries only the public domain demo set.
- "Import JSON" in the library is a file picker that takes several files at once. There is no drag-drop and no paste import on the library. Files are zod-validated. A backup file restores every song and set, with one confirm when ids clash. A single song file with a new id is added as a new song. Over an existing song, lyrics must match the library copy or the file is refused, and after a confirm its placements replace the song's placements outright, with no review step.
- Placements in either path: col-form values are bounded to 0-200, anchor-form values are resolved via `resolveAnchor`, and unresolved entries are listed, never silently dropped.
- The only review flow is "Paste AI reply" in the editor, which pastes JSON for the open song. Its placements arrive as amber proposals (accept per chip, per line, or all at once, or discard them), not an instant overwrite.

## AI round trip (v1: no AI in the tool)

- `docs/AI-PLACEMENT.md`: self-contained instructions for any Claude instance. Schema, anchor form, sounding-chords rule (chords entered exactly as printed in the chart image), and hard rules: only add or modify the placements array; never alter lyrics or any other field; never output lyric text beyond short anchor substrings quoted from the provided JSON; skip chords over lyrics not present in the JSON; ignore section labels, tablature, and chord diagrams in the image.
- "Copy AI prompt" button copies one paste-ready prompt containing those instructions plus the current song JSON. Workflow: paste into Claude Code or claude.ai with the screenshot attached, paste the returned JSON through "Paste AI reply", review chips, accept.
- Claude Code running in this repo may instead compute exact cols programmatically (string indexOf); both forms import fine.

## Client

One `useReducer` store (`state/songStore.ts`) with dirty flag and autosave timer. Components: `Library` (list, create with paste-lyrics textarea, rename, delete, import, export), `Editor` (monospace grid), `LyricLine` (chord row above a `pre` lyric row, click computes col from measured char width), `ChordChip` (absolutely positioned at `col`ch, pointer-capture drag with snap-to-cell, vertical drag crosses lines, click to edit), `ChordEditPopover` (live parse validation, delete, shape-space entry under capo), `Toolbar` (transpose, key readout and override, capo 0-9 and Suggest capo, header preview, Copy text, Print), an editor bar above it (Copy AI prompt, Paste AI reply, Edit lyrics), `CapoSuggestions`, `ImportReview`, `PrintSheet` (header plus interleaved chord and lyric text rows).

Print CSS: `@media print` hides everything except `.print-sheet`; `@page { margin: 15mm }`; roughly 10.5 pt monospace, about 90 columns; `white-space: pre`; each chord and lyric pair wrapped in `.line-pair { break-inside: avoid }`. The editor warns on lines over 90 characters.

## Phases

1. Scaffold and dev loop (Vite, Vitest, shell renders, build clean).
2. Chord engine, tests first (parsing, transpose, enharmonics, key detection, capo math and suggestions, row building, anchor resolution).
3. Library, storage, import/export, seed song.
4. Manual editor: click to place, drag to move, edit, delete, autosave.
5. AI round trip: AI-PLACEMENT.md, Copy AI prompt, import review flow; verified end to end with public domain material.
6. Transpose, key, and capo controls.
7. Print-first output.
8. Polish: plain-text export, keyboard shortcuts, warnings, README.
9. Deferred, optional: full buildout for other users. Minimal Hono API server. Songs CRUD moves to disk with atomic writes. In-app screenshot upload consumed in memory. POST /api/ai/place calls the Anthropic API server-side (@anthropic-ai/sdk, structured output, the strongest available model as the default, key in .env) with the same anchor protocol. The client downscales images to 2576 px long edge, 5 MB cap. Everything from v1 (schema, engine, review UI) is reused as-is.

## PDF chart ingest (src/ingest/)

The library's "Import PDF" button reads a chord chart PDF that carries a text layer and shows a review panel (PdfImportReview.tsx) before the song is added. `npm run ingest-pdf -- <chart.pdf>` runs the same path from the command line and writes a library song outside the repo. `src/ingest/readPdf.ts` turns pdf.js's operator list into text operators, `pdfWords.ts` groups glyphs into word boxes the way poppler's `pdftotext -bbox` does, and `chartPdf.ts` turns word boxes into a Song and a correction log. The last two are pure and table tested on synthetic input built from the demo set. pdf.js loads only when a PDF is picked, as its own chunk plus a worker, so the main bundle does not carry it. Workflow, review checklist, and known limits are in docs/PDF-INGEST.md.

## Chord diagrams (src/engine/shapes.ts, ChordDiagram.tsx, ChordChartRow.tsx)

A CHORDS row shows SVG fretboard grids for the song's unique displayed shapes (post-capo) in first-appearance order: collapsible panel on screen, a row under the print header spanning both columns. Voicings resolve in order: curated open-chord table, known slash voicings, movable E-form and A-form templates (lower position wins). Chords outside the dictionary walk a simplification ladder (drop slash bass, maj9 to maj7, 13/9/11 and altered dominants like 7b9 or +7 to 7, 9sus4 and 13sus4 to 7sus4, m11 to m7 to m, dim family to m7b5/dim7, 2 to sus2 as a pure alias) so every parseable chord gets the closest reasonable shape, labeled with the song's own symbol, and screen tooltips name the substitution. Dots only, no fingering numbers, by Jamie's choice. Hovering a chord chip in the editor for 330 ms pops the same diagram in a fixed-position card (above the chip, below for the top line). It hides on pointer-out, never appears mid-drag, and approximated shapes carry a "shows X" note.

## Arrangements (src/client/lib/arrangement.ts, ArrangementPanel.tsx, VersionBar.tsx)

A finished song often gets played differently from the chart: a double chorus, an extra bridge, an outro repeated while someone speaks. Each named version is an ordering over the song's own sections, stored inside the song. Steps find their section the way section marks do, by label text and occurrence, so words and chords live only in the song as written and a chord fix there reaches every version.

- `renderArrangement(song, arrangement)` materializes a version into an ordinary Song: each step's label (with " x3" for a repeat), its cue as a "(cue)" line, its lines and chords copied with remapped line numbers, exactly one blank between steps. PrintSheet, sheetText, ChordChartRow, and LyricLine render that Song unchanged. The sounding key always comes from the song as written, because reordering can change what detectKey guesses.
- A bare label with nothing under it (a chart's "[Chorus]" as a repeat marker) plays the first same-named section that has content.
- Unlabeled lines above the first label are an "Opening" section. They print without a label unless they repeat, carry a cue or mark, or play after another section.
- References follow their label line through every lyric edit (`retargetSections` in lineOps.ts), because deleting or adding a label shifts the occurrence of every later label with the same text. Single-line edits know exactly where each line went. The whole-text Edit lyrics path matches unchanged lines first (longest common subsequence), then pairs leftover labels in order when the counts agree, which is a rename. A label that is gone takes its marks and steps with it, rather than letting them resolve to whichever section now holds the old anchor. Its lines joined the section above, so the version still plays them. Deleting a label that versions use asks first, and Edit lyrics reports how many references it dropped.
- A step whose section no longer exists for any other reason is skipped in the render and flagged in the panel.
- The version's sheet is read-only. Key, capo, transpose, notes, and BPM belong to the song and apply to every version.
- Printing repeats a section in full each time it appears in the order, since the sheet is for playing along, and a step's repeat count prints once as "x2" on its label.
- Sets pick a version per entry. Deleting a version drops it from set entries, which fall back to the song as written.

## Later ideas (not scheduled)

- Per-version key and capo, for a service led in a different key.

- Short tablature snippets for riffs.
- Smarter placement re-anchoring when lyrics are edited after placement.
- Voicing picker (cycle alternates per diagram); hand-editable fingerings.

## Risks

1. Print alignment: literal text rows in print, never positioned elements; verified in a real print preview.
2. Engine correctness: pure module built first with table-driven tests; manual key override as escape hatch.
3. AI miscounting positions: anchor form resolved deterministically on import; unresolved surfaced; everything reviewable.
4. AI altering lyrics: import review accepts only placements; lyric changes rejected by design.
5. Lyrics edited after placement: clamp and warn.
6. Two-tab autosave races: last-write-wins, documented.
7. Copyright hygiene: only public domain lyrics in the repo, the personal library kept outside it, screenshots never enter the tool or repo, model output is chords and positions only.
