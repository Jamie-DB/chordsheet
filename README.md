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
5. Print. The printed sheet is literal monospace text rows, so chords land above exactly the right characters and a chord row never separates from its lyric across pages. "Copy text" puts the identical plain-text sheet on the clipboard.

Shortcuts: `+` and `-` transpose; `Escape` closes any open popover or panel.

## Storage

Songs autosave to browser localStorage. "Export" downloads a song as JSON; keep those files in `songs/` and commit them (this repo is private). "Import JSON" loads them back. `songs/amazing-grace.json` is the public domain seed used by tests.

## Layout model

Everything is character cells in one monospace font. A chord at column N renders at `left: N * 1ch` in the editor, and the print sheet is built by `buildChordRow` as literal text (spaces plus symbols, collisions shifted right). Stored chords are always sounding chords; capo is a pure display transform. See CLAUDE.md for the full invariants and DESIGN.md for the design.
