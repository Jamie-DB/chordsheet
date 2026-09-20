# PDF chart ingest

How to turn a chord chart PDF into a song in the library without building upload or OCR into the app. The app stays a static SPA. A local script does the reading, and a person (or a Claude Code session) proofreads the result.

## When this applies

The PDF must carry a real text layer, which is the normal case for charts exported from a chart service. Check with `pdftotext chart.pdf - | head`. If that prints nothing, the PDF is a scan and this script cannot read it. Use the screenshot round trip in `docs/AI-PLACEMENT.md` for those.

Needs poppler on PATH: `brew install poppler`.

## The workflow

1. Run `npm run ingest-pdf -- path/to/chart.pdf --dry-run`.
2. Read the preview with the PDF open next to it. The preview prints every chord row over its lyric line, the section marks, and a list of every correction the script made.
3. Work through the review checklist below.
4. Run it again without `--dry-run`. The song lands in `~/Documents/chordsheet-library/<id>.json`, or in the folder given as the second argument.
5. In the app, load the file from the library folder and fix anything the checklist turned up.

The script refuses to write inside the repo, because ingested charts are usually copyrighted. It refuses to overwrite an existing file unless `--force` is passed.

Flags: `--key Bb` overrides the key read from the header. `--force` overwrites. `--dry-run` writes nothing.

## Review checklist

- Every line under "corrections and judgment calls". Each one is a place where the script changed what the text layer said.
- Accidentals on every chord. The text layer drops sharp and flat glyphs, and the script restores them three ways: from a gap inside the symbol, from unexplained width in a one-word symbol, and from the key signature when the accidental was the last glyph of the symbol (a slash bass, or a chord that is only a root letter). The third is a guess. A chart that uses a natural note against the key signature will come out wrong.
- Bare root letters in sharp keys. A lone G in the key of A is left natural, because the borrowed G major is more common than G sharp major, and the log flags each one. In flat keys the flat is restored (a lone B in F becomes Bb).
- The key itself. The header loses its accidental too, so a chart in Bb reads as B. Pass `--key` when the key has an accidental.
- Chords the engine cannot hold as printed. A slash inside a quality (6/9 over a bass note) is rewritten without the inner slash. A superscript 1 is dropped.
- Chords the chart prints over a rest between words. They are placed on the space before the next word.
- Lyric text. It comes from the PDF's text layer, so it is as accurate as the chart. Curly apostrophes become straight ones.

## How it works

`pdftotext -bbox` reports every word with its bounding box. `src/ingest/chartPdf.ts` groups the boxes into rows per column and page, then sorts rows into labels, band notes, chord rows, and lyric rows by glyph height and content. A chord row belongs to the lyric row under it. The chord's x position maps to a character cell: proportionally inside a word, or the space before the next word when it sits in a gap. A chord row with no lyric under it becomes an instrumental line. Band notes under a section label become section marks through the same `extractLabelNotes` the app uses, and the output is validated with `songSchema`.

The module is pure and table tested. Its fixtures are synthetic word boxes built from the demo set. No real chart is stored in the repo, as a PDF or as a fixture.

## Known limits

- Tuned to one chart vendor's layout: two columns, fixed glyph heights per role, a small bubble glyph before each section label. Another vendor's charts will need new constants at the top of `chartPdf.ts`.
- Verified on 3 real charts: 2 in the key of A and 1 in F. The F chart used a single flat chord (Bb), so flats inside longer symbols and flat slash basses are still unchecked against a real chart.
- The glyph width table covers only the letters seen so far (A through G, m, and the slash). A one-word chord made of other letters skips the width check.
- Repeat counts on the roadmap bubbles at the top of the chart are ignored.
