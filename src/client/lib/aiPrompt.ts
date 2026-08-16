import type { Song } from "../../shared/types";
import { songToJson } from "./exchange";

/**
 * One paste-ready prompt: instructions plus the current song JSON.
 * The attached screenshot supplies the chord chart; the reply is the same
 * JSON with placements filled in, and never any lyric text beyond anchors.
 */
export function buildAiPrompt(song: Song): string {
  return `I am annotating a song I have the lyrics to. Below is my song data as JSON. I am attaching an image of a chord chart for this song. Fill the "placements" array with the chords shown in the image and reply with the complete JSON only, no commentary.

Rules:
1. Only fill "placements". Never change "lyrics", "title", or any other field.
2. Each placement is: {"line": <0-based index into lyrics>, "chord": "<symbol exactly as printed in the image>", "anchor": "<1 to 3 words copied verbatim from that lyric line>", "anchorOccurrence": <nth occurrence of the anchor in that line, 1-based, default 1>, "offsetInAnchor": <characters into the anchor where the chord sits, default 0>}.
3. Never write lyric text anywhere except those short anchor substrings, quoted verbatim from the JSON below.
4. Chords go in exactly as printed in the image, including slash basses.
5. If the image's wording or line breaks differ from my lyrics, align each chord to the best-matching line below; skip chords over words that do not exist in my lyrics.
6. Ignore section labels, tablature, and chord diagram graphics; capture chord symbols only.
7. A chord printed inside a diamond (or angle brackets like <C>) is a full-measure hold: add "hold": true to that placement.
8. If and only if you can compute exact character offsets reliably (for example by running code), you may use {"line", "col", "chord"} instead of the anchor form.

My song JSON:

${songToJson(song)}`;
}
