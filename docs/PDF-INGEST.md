# PDF chart ingest

How to turn a chord chart PDF into a song in the library. The PDF is read in the browser with pdf.js, so the app stays a static SPA and the file never leaves the machine. No OCR: the PDF has to carry text.

## When this applies

The PDF must carry a real text layer, which is the normal case for charts exported from a chart service. A scan has none, and the app says so when one is picked. Use the screenshot round trip in `docs/AI-PLACEMENT.md` for those.

## In the app

1. In the library, click "Import PDF" and pick the chart.
2. The review panel shows the song's title, artist, line and chord counts, every chord it read, a list of every correction the ingest made, and a preview of every chord row over its lyric line.
3. Check the key. The header loses its own sharp or flat, so a chart in Bb reads as B. Picking the real key reads the chords again with that key signature.
4. Work through the review checklist below with the PDF open next to it.
5. "Add to library" adds the song and opens it in the editor. Fix anything the checklist turned up there. If a song with the same title is already in the library, the panel says so and the new one gets its own id (`be-still-2`), so nothing is replaced.

A PDF in a different chart layout reads as no song, and the panel says so rather than adding an empty one.

## From the command line

`npm run ingest-pdf -- path/to/chart.pdf --dry-run` runs the same reader and ingest and prints the same preview and corrections. Without `--dry-run` the song lands in `~/Documents/chordsheet-library/<id>.json`, or in the folder given as the second argument. It refuses to write inside the repo, because ingested charts are usually copyrighted, and refuses to overwrite an existing file unless `--force` is passed.

Flags: `--key Bb` overrides the key read from the header. `--force` overwrites. `--dry-run` writes nothing.

## Review checklist

- Every line under "corrections and judgment calls". Each one is a place where the script changed what the text layer said.
- Accidentals on every chord. The text layer drops sharp and flat glyphs, and the script restores them three ways: from a gap inside the symbol, from unexplained width in a one-word symbol, and from the key signature when the accidental was the last glyph of the symbol (a slash bass, or a chord that is only a root letter).
  - The gap and width checks show that a glyph is missing but not which one, so they take the key's direction: flat in the flat keys, sharp in C and the sharp keys. Where that would spell B#, E#, Cb, or Fb they use the other accidental and log it, so a B in C with a missing glyph becomes Bb, and an F in Bb becomes F#. A borrowed chord against that direction still comes out wrong (an Ab in C comes out as A#).
  - The key signature check is a guess. A chart that uses a natural note against the key signature will come out wrong.
  - A minor key takes its relative major's signature, so D minor restores like F major (Bb) and B minor like D major (F# and C#).
- Bare root letters in sharp keys. A lone G in the key of A is left natural, because the borrowed G major is more common than G sharp major, and the log flags each one. In flat keys the flat is restored (a lone B in F becomes Bb).
- The key itself. The header loses its accidental too, so a chart in Bb reads as B. Pass `--key` when the key has an accidental.
- Chords the engine cannot hold as printed. A slash inside a quality (6/9 over a bass note) is rewritten without the inner slash. A superscript 1 is dropped.
- Chords the chart prints over a rest between words. They are placed on the space before the next word.
- Lyric text. It comes from the PDF's text layer, so it is as accurate as the chart. Curly apostrophes become straight ones.

## How it works

`src/ingest/readPdf.ts` reads pdf.js's operator list for each page (nothing is rendered). `src/ingest/pdfWords.ts` places every glyph from the text operators and groups glyphs into words the way poppler's `pdftotext -bbox` does: whitespace, a gap wider than a tenth of the font size, or a change of size or baseline ends a word. A box runs from the font's descent to its ascent around the baseline. The ingest was tuned against poppler's boxes, so matching them keeps its constants valid. pdf.js's own text extraction merges words into runs and could not be used for this.

On the 3 real charts the ingest was tuned on, the pdf.js reader produced the same song as `pdftotext -bbox`: same lyrics, same placements, same chords. Word boxes matched poppler's to within 0.01pt. The one difference is on the chart with F#m chords. Poppler joins the F and the m across the gap the dropped sharp leaves, and pdf.js keeps them apart, so the sharp is restored by the gap check rather than the width check, with the same result.

`src/ingest/chartPdf.ts` groups the boxes into rows per column and page, then sorts rows into labels, band notes, chord rows, and lyric rows by glyph height and content. A chord row belongs to the lyric row under it. The chord's x position maps to a character cell: proportionally inside a word, or the space before the next word when it sits in a gap. A chord row with no lyric under it becomes an instrumental line. Band notes directly under a section label become section marks through the same `extractLabelNotes` the app uses. A note further down a section, after a chord or lyric row, has no line to ride on, so it goes to the song's notes as "Chart note in [Section]: ..." and the log says so. The output is validated with `songSchema`.

The modules are pure except `readPdf.ts` and table tested. Their fixtures are synthetic word boxes and text operators built from the demo set. No real chart is stored in the repo, as a PDF or as a fixture.

## Known limits

- Tuned to one chart vendor's layout: two columns, fixed glyph heights per role, a small bubble glyph before each section label. Another vendor's charts will need new constants at the top of `chartPdf.ts`.
- Verified on 3 real charts: 2 in the key of A and 1 in F. The F chart used a single flat chord (Bb), so flats inside longer symbols and flat slash basses are still unchecked against a real chart.
- The glyph width table covers only the letters seen so far (A through G, m, and the slash). A one-word chord made of other letters skips the width check.
- Repeat counts on the roadmap bubbles at the top of the chart are ignored.
- The reader handles horizontal text only. Rotated text gets wrong boxes, which chart exports have not used.
