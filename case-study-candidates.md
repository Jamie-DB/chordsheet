# Case-Study Candidates: chordsheet

*Sources: the origin build session survives in full (~/.claude/projects/-Users-jamie-Dev-tools/84b8cf7e-743b-4a85-abb7-d4e4f74bc3b3.jsonl, also in the Sep 1 transcript archive), plus the 31-issue GitHub trail and commit history. Quotes below are verbatim from the transcript. Rule for public excerpts: song titles are fine, lyric lines never appear.*

## The constraint became the architecture
Date: Aug 5, 2026 | Evidence: transcript line 5 (opening message), DESIGN.md, commit a38de12, issue #5 | Type: architecture decision from a constraint
Situation: The project's first message, before any code existed.
Moment: Jamie's opening spec already contained the design insight: "I want control of the chords in the placement because what I've run into is trying to get an AI to do this runs into copyright with the text." The whole AI integration was shaped by it: the user supplies lyrics they have, and the AI round-trip emits only chord names and positions anchored to that text, reviewed as accept-or-reject chips. (Public framing note: present this as designing the AI's role so it never generates copyrighted lyric content, which is exactly what the README says.)
Result: The AI-assist feature works where a naive "lay out this chord sheet" prompt gets refused. The constraint that breaks the lazy version of the tool is the reason the careful version exists.

## "New tact. no background color, it's too busy."
Date: Aug 16, 2026 | Evidence: transcript lines 2110 and 2496, issues #28 and #29, commits e99f0f4 then fc12337 | Type: overruled a design choice
Situation: Section dynamics marks had just shipped with tinted section backgrounds, exactly as requested an hour earlier.
Moment: Jamie looked at the working implementation and reversed the direction: "New tact. no background color, it's too busy. How about just tags, and side-bar markings. Is a section is marked tacet, let's play with reducing the font of the words and chords by about 33% so that section tightens up and moves out of the way, but is still followable on a music stand." The judgment standard is in that last clause: the artifact is read at distance, mid-song, on a music stand.
Result: The shipped design is quieter and denser: tag pills, a print sidebar with a thin edge bar, and tacet sections at two-thirds size. The tinted version lasted about an hour.

## Fix one song, then audit the library
Date: Aug 6, 2026 | Evidence: transcript line 1649, issue #24, commits 37b48bb and c86f201 | Type: caught a bug, then generalized the fix
Situation: Transposing a song revealed some chords were not responding.
Moment: "There are chords that got imported at text-lines. So they don't update when we transpose/capo etc. Please fix this song's JSON data, and use what you learn to audit the other songs." Not just a bug report: an instruction to convert the diagnosis into a library-wide audit and a parser that recognizes bar notation so the class of bug stops recurring.
Result: A bar-notation-aware parser, every song repaired, and a follow-up commit for the misalignment fallout the repair exposed.

## "Your scan missed some section tags that already had notes."
Date: Aug 16, 2026 | Evidence: transcript line 2774 (with screenshot), issue #31, commit 45b89fa | Type: verification catch
Situation: A migration had just unified section tags across the library, and the agent reported it complete.
Moment: Jamie checked the actual rendered output against the claim and caught the gap, with a screenshot: labels carrying inline notes ("[Verse 1] *soft piano*") had been skipped by the scan. "Check other files too."
Result: The migration actually completed. Trust the diff, verify the render.

## Brave says no
Date: Aug 6, 2026 | Evidence: transcript lines 1278 to 1390, issue #20, commits 8e907dc and 0e2d788 | Type: iterated past "works"
Situation: Save-to-folder had just shipped via the File System Access API and worked in the dev browser.
Moment: "I'm in Brave and it's blocking like it's in Safari." The daily-driver browser disables the API by default. Rather than a shrug or a Chrome-only note, the feature grew a Brave-specific guidance path and a universal one-file backup that works everywhere, and the save button stopped hiding when unsupported, explaining itself instead.
Result: Persistence works for the actual user in the actual browser, with a fallback any browser can use.

## The idea that stayed an issue
Date: Aug 6, 2026 | Evidence: transcript line 1525, issues #22 and #9 (both open) | Type: cut scope deliberately
Situation: Mid-flow feature momentum, two days into the project.
Moment: A genuinely attractive idea (a drag-and-drop arrangement timeline for song sections) got written down instead of built: "Just capture the idea for now, not sure on it yet." Same discipline as issue #9, the multi-user buildout, filed on day one and deferred on day one.
Result: The tool stayed a lean personal tool that shipped in days and gets used weekly. Two open issues mark the roads not taken, on purpose.
