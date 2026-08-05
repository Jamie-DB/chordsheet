# chordsheet design

The contract all phases and roadmap issues are cut from. See CLAUDE.md for invariants and conventions.

## Problem

Asking an AI to produce a chord-over-lyrics sheet directly hits copyright refusals because of the lyric text. This tool sidesteps that: Jamie pastes the lyrics and controls placement. When AI helps at all, it only ever outputs functional data (chord symbols, line indices, short anchor substrings quoted from Jamie's own pasted text), never lyric content.

## v1 scope

Static SPA (Vite + React 19 + TS + Vitest + zod). No server, no API keys. Print-first output. Manual placement editor, capo and transpose controls, key detection, JSON export/import, and an export-to-Claude-Code round trip for screenshot-based placement.

## Data model

```ts
interface ChordPlacement { id: string; line: number; col: number; chord: string }
// chord is the canonical SOUNDING symbol, e.g. "Bbmaj7", "G/B", "F#m7"

interface Song {
  version: 1;
  id: string;            // slug; export filename <id>.json
  title: string;
  artist?: string;
  lyrics: string[];      // lines verbatim from paste; tabs expanded, trailing whitespace trimmed
  placements: ChordPlacement[];
  keyOverride: string | null;   // "Eb", "Cm", ...; null = auto-detect
  capo: number;          // 0-9
  createdAt: string;     // ISO 8601
  updatedAt: string;
}
```

Import additionally accepts placements in anchor form `{line, chord, anchor, anchorOccurrence?, offsetInAnchor?}` (no col, no id). The tool resolves anchors to columns deterministically because models miscount character offsets but quote substrings reliably.

## Chord engine (src/engine/, pure TS, zero deps)

- `notes.ts` pitch-class math; sharp and flat spelling tables.
- `chord.ts` `parseChord` / `isChordSymbol` / `formatChord`. Root `[A-G](#|b)?`, normalized quality set (m, 7, maj7, m7, m7b5, dim, dim7, aug, sus2, sus4, 7sus4, 6, m6, 9, m9, add9, 11, 13, 5), optional slash bass. Unknown suffixes preserved verbatim as opaque quality; transpose still works on root and bass.
- `transpose.ts` `transposeSymbol(symbol, semitones, prefer)`.
- `key.ts` `detectKey(symbols)` scores all 24 keys: diatonic triad match +3, root-in-scale +1, first and last chord tonic +3 each, dominant present +1. Also `keyPrefersFlat`, `transposeKeyName`.
- `capo.ts` `displayChord`, `shapedKey` (key minus capo), `soundingFromShape` (entry while capo > 0), `scoreCapoFret`, `suggestCapo` (frets 0-9 ranked by open-shape friendliness: open majors and 7ths of C A G E D plus B7 score +3, open minors Am Em Dm +3, barre-only roots -1, weighted by occurrence count; ties break toward the lower fret).
- `layout.ts` `buildChordRow` (print and export row builder; chords padded to their columns, collisions shifted right keeping one space between symbols) and `resolveAnchor` (nth-occurrence substring search: exact, then case-insensitive, then first word).

## Paste ingestion (src/client/lib/tabPaste.ts)

Song creation runs the pasted text through `parsePastedTab`. A line whose every whitespace-separated token parses as a chord symbol is a chord line: its tokens become placements at their exact columns on the following lyric line, and the chord line leaves the lyrics array. Chord lines with no lyric line beneath them (intros, instrumentals, stacked rows) attach to an inserted empty line so they still print as standalone rows. A "Written for capo" selector on the create form covers tabs written for a capo: symbols are read as shapes at that fret, transposed up to sounding for storage, and the song starts with that capo set, so the sheet initially shows exactly what was pasted and later capo moves never change the song. Known false positive: a lyric line consisting of a single note-name word ("A"); one click fixes it.

## Storage and exchange

- localStorage key `chordsheet.songs.v1` holds the library. Autosave debounced 800 ms. Last-write-wins across tabs (accepted limitation).
- Export downloads `<id>.json`, pretty-printed. Jamie files these under `songs/` and commits when wanted.
- Import via file picker, drag-drop, or paste. zod-validated. Col-form placements clamped; anchor-form placements resolved via `resolveAnchor`; unresolved entries listed, never silently dropped. Importing over an existing song requires confirm; imported placements arrive as review proposals (accept all, accept per line, discard), not an instant overwrite.

## AI round trip (v1: no AI in the tool)

- `docs/AI-PLACEMENT.md`: self-contained instructions for any Claude instance. Schema, anchor form, sounding-chords rule (chords entered exactly as printed in the chart image), and hard rules: only add or modify the placements array; never alter lyrics or any other field; never output lyric text beyond short anchor substrings quoted from the provided JSON; skip chords over lyrics not present in the JSON; ignore section labels, tablature, and chord diagrams in the image.
- "Copy AI prompt" button copies one paste-ready prompt containing those instructions plus the current song JSON. Workflow: paste into Claude Code or claude.ai with the screenshot attached, take the returned JSON, import, review chips, accept.
- Claude Code running in this repo may instead compute exact cols programmatically (string indexOf); both forms import fine.

## Client

One `useReducer` store (`state/songStore.ts`) with dirty flag and autosave timer. Components: `Library` (list, create with paste-lyrics textarea, rename, delete, import, export), `Editor` (monospace grid), `LyricLine` (chord row above a `pre` lyric row; click computes col from measured char width), `ChordChip` (absolutely positioned at `col`ch; pointer-capture drag with snap-to-cell; vertical drag crosses lines; click to edit), `ChordEditPopover` (live parse validation, delete, shape-space entry under capo), `Toolbar` (transpose, key readout and override, capo 0-9, header preview, Copy AI prompt, Export, Print), `CapoSuggestions`, `ImportReview`, `PrintSheet` (header plus interleaved chord and lyric text rows).

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
9. Deferred, optional: full buildout for other users. Minimal Hono API server; songs CRUD moves to disk with atomic writes; in-app screenshot upload consumed in memory; POST /api/ai/place calls the Anthropic API server-side (@anthropic-ai/sdk, structured output, claude-sonnet-5 default, key in .env) with the same anchor protocol; client downscales images to 2576 px long edge, 5 MB cap. Everything from v1 (schema, engine, review UI) is reused as-is.

## Chord diagrams (src/engine/shapes.ts, ChordDiagram.tsx, ChordChartRow.tsx)

A CHORDS row shows SVG fretboard grids for the song's unique displayed shapes (post-capo) in first-appearance order: collapsible panel on screen, a row under the print header spanning both columns. Voicings resolve in order: curated open-chord table, known slash voicings, movable E-form and A-form templates (lower position wins). Chords outside the dictionary walk a simplification ladder (drop slash bass; maj9 to maj7; 13/9/11 to 7; m11 to m7 to m; dim family to m7b5/dim7; 2 to sus2 as a pure alias) so every parseable chord gets the closest reasonable shape, labeled with the song's own symbol; screen tooltips name the substitution. Dots only, no fingering numbers, by Jamie's choice.

## Later ideas (not scheduled)

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
7. Copyright hygiene: private repo, public domain seed lyrics, screenshots never enter the tool or repo, model output is chords and positions only.
