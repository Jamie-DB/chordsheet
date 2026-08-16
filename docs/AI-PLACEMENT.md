# AI placement round trip

How to have a Claude instance (claude.ai or Claude Code) place chords from a screenshot of a chord chart onto a song in chordsheet, without the AI ever producing lyric text.

## The workflow

1. In the chordsheet editor, click "Copy AI prompt". The clipboard now holds instructions plus the song's JSON.
2. Paste that into Claude (claude.ai chat or Claude Code) and attach a screenshot of the chord chart you want to copy placements from.
3. Claude replies with the same JSON, placements filled in.
4. Copy the reply, click "Paste AI reply" in the editor, paste, import.
5. Proposed placements appear as amber chips. Click a chip to accept it, use the per-line buttons, or accept everything at once. Nothing changes until you accept.

## Why this shape

Chord symbols and their positions are functional data, not creative expression. The AI only ever outputs chord names, line numbers, and short anchor substrings quoted from lyrics you supplied. The tool validates the reply: lyric or metadata changes are rejected wholesale (the library copy wins), and only the placements array is ever read.

## The data the AI returns

Each placement uses one of two forms.

Anchor form (preferred for chat models; models miscount characters but quote reliably):

```json
{ "line": 0, "chord": "C", "anchor": "sweet the", "anchorOccurrence": 1, "offsetInAnchor": 0 }
```

- `line`: 0-based index into the song's `lyrics` array.
- `chord`: the symbol exactly as printed in the image (Am7, G/B, Bbmaj7...).
- `anchor`: 1 to 3 words copied verbatim from that lyric line, marking where the chord sits.
- `anchorOccurrence`: which occurrence of the anchor in the line, 1-based, default 1.
- `offsetInAnchor`: characters into the anchor above which the chord belongs, default 0.
- `hold` (optional): true when the chart draws the chord inside a diamond (or as `<C>`), meaning a full-measure hold. Works on both placement forms.

Column form (fine when the writer can compute string offsets exactly, e.g. Claude Code running a script):

```json
{ "line": 0, "col": 19, "chord": "C" }
```

`col` is the 0-based character cell of the lyric line the chord sits above.

The tool resolves anchors deterministically (exact nth occurrence, then case-insensitive, then the anchor's first word) and lists anything unresolvable for manual fixing; nothing is silently dropped.

## Rules given to the AI

1. Only fill the `placements` array. Never change `lyrics`, `title`, or any other field.
2. Never write lyric text anywhere except the short `anchor` substrings, quoted verbatim from the provided JSON.
3. Chords go in exactly as printed in the image. They are the sounding chords of that chart; transposition and capo shaping happen in the tool afterward.
4. If the image's lyric wording or line breaks differ from the provided lyrics, align each chord to the best-matching provided line. Skip chords that sit over words not present in the provided lyrics.
5. Ignore section labels (Verse, Chorus), tablature staves, and chord diagram graphics; capture chord symbols only.
6. Reply with the complete JSON only, no commentary around it.

## Note for Claude Code in this repo

You can edit `songs/<id>.json` files directly with the same rules, or compute exact `col` values programmatically (`line.indexOf(word)`), which avoids anchor resolution entirely. `src/shared/schemas.ts` holds the validating schema, and `npm test` exercises the import path.
