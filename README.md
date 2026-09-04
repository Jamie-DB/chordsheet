# chordsheet

A personal tool for making play-along guitar chord sheets. Paste lyrics you have, place chord symbols above the exact syllables, transpose or capo them to the shapes you like, and print a clean monospace sheet.

Built to route around a real annoyance: asking an AI to lay out a chord-over-lyrics sheet trips copyright refusals because of the lyric text. Here, you supply the lyrics and control every placement. When AI helps, it only ever emits chord names and positions anchored to your own pasted text (see docs/AI-PLACEMENT.md), never lyric content.

## Quick start

```
npm install
npm run dev      # http://localhost:5173
```

`npm test` runs the Vitest suite. `npm run build` type-checks and builds; `npm run preview` serves the build.

## Workflow

1. Create a song: paste plain lyrics, or a whole found tab with chord lines above the words. Chord lines are detected (every token parses as a chord) and become placements at their exact columns; standalone chord rows (intros, instrumentals) keep their own row. If the tab says "Capo N", set "Written for capo" so its symbols are read as shapes at that fret: the song then starts at capo N showing exactly what you pasted, while the header carries the true sounding key.
2. Place chords: click a spot to add one, click a chord to edit or delete it, drag to move it (vertically too). Entry validates chord symbols live (Am7, G/B, Bbmaj7, F#m7b5...).
3. Optional AI assist: click "Copy AI prompt", paste it into Claude (claude.ai or Claude Code) with a screenshot of an existing chart, then "Paste AI reply". Proposed chords show as amber chips; accept per chip, per line, or all at once. Unresolvable anchors are listed; lyric changes in the reply are rejected.
4. Set the key and capo: the key is auto-detected from your chords (override available). Capo keeps the song's real key and shows the shapes your hands play, with a header like "Key: Eb, Capo 3". "Suggest capo" ranks frets by open-chord friendliness. Transpose changes the actual key; both controls exist on purpose.
5. At-a-glance notation: the chord popover's diamond checkbox marks a full-measure hold, drawn as a diamond around the chord (Nashville style; plain-text export writes it as <C>). Each [Section] label carries a small pill for dynamics marks: Tacet, Soft, Build, Full, or a custom word with a color. On the printed page (single-column layout) section titles move out of the flow into a left sidebar with the mark as a colored tag beneath, plus a thin edge bar along marked sections; Tacet sections shrink to about two thirds size so they tighten up and move out of the way. The dense two-column layout keeps compact in-line labels.
6. Chord diagrams: a CHORDS row shows fretboard grids for the song's displayed shapes (post-capo), on screen in a collapsible panel and at the top of the printed page. Voicings come from a curated open-chord table plus movable barre forms; unusual chords fall back to the closest reasonable shape and the on-screen tooltip names the substitution.
6. Play along: the floating Scroll control auto-scrolls the sheet. Speed is in BPM (detected from pasted tabs, default 80, saved per song); Space toggles.
7. Print. The printed sheet is literal monospace text rows, so chords land above exactly the right characters and a chord row never separates from its lyric across pages. Short-line songs print in two columns automatically. "Copy text" puts the identical plain-text sheet on the clipboard.

Shortcuts: `+` and `-` transpose; `Space` toggles auto-scroll; `Escape` closes any open popover or panel.

## Library and sets

The library lists songs alphabetically by default, with a search box (title and artist) and a sort selector (Title, Artist, Recently updated, Recently added) that remembers your choice. Sets group songs in order for a service: create one in the Sets section, add songs (repeats allowed), reorder, then step through it in the editor with Prev and Next. Deleting a song removes it from every set. Sets ride along in "Save all to folder" (one setlists.json) and in Download backup.

## Storage

Songs autosave to browser localStorage. "Save all to folder" in the library writes every song as `<id>.json` straight into a folder you pick once; it checks the disk first and skips files that are already up to date, so repeated saves are idempotent. Point it at a folder outside this repo (`~/Documents/chordsheet-library/`), never at `songs/`: the personal library holds copyrighted lyrics and stays out of git entirely. `songs/` in the repo is only the public domain demo set. Note for Brave: it disables the File System Access API by default; enable it at brave://flags (search "File System Access API") and relaunch, or use "Download backup", which saves the whole library as one chordsheet-library.json in any browser and restores through Import. Per-song "Export" and "Import JSON" remain for one-offs. `songs/amazing-grace.json` is the public domain seed used by tests.

## Layout model

Everything is character cells in one monospace font. A chord at column N renders at `left: N * 1ch` in the editor, and the print sheet is built by `buildChordRow` as literal text (spaces plus symbols, collisions shifted right). Stored chords are always sounding chords; capo is a pure display transform. See CLAUDE.md for the full invariants and DESIGN.md for the design.
