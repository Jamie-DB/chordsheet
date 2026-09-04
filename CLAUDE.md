# chordsheet

Personal tool for making play-along guitar chord sheets. Jamie pastes lyrics, places chord symbols above exact characters, and prints a clean monospace sheet. No AI and no server in v1; screenshot-based placement happens through an export-to-Claude-Code round trip (see docs/AI-PLACEMENT.md).

## Commands

- `npm run dev` starts Vite on 5173
- `npm test` runs Vitest once; `npm run test:watch` watches
- `npm run build` type-checks and builds; `npm run preview` serves the build

## Architecture

Fully static SPA: Vite + React 19 + TypeScript. No backend, no API keys, no .env.

- `src/engine/` pure TypeScript chord/music engine, zero dependencies, fully unit tested. UI code never does pitch math itself.
- `src/shared/` Song types and zod schemas (used for import validation).
- `src/client/` React app: one useReducer store, no router, no state library.
- `songs/` the public domain demo set, committed: Amazing Grace, Holy Holy Holy, and It Is Well with My Soul. The personal library lives outside the repo at `~/Documents/chordsheet-library/` and is never committed, and that is the folder "Save all to folder" points at. The browser's localStorage holds the working copy; export/import moves songs between the two. `npm run repair-songs` sweeps `songs/*.json` only, so it covers the demo set and never the personal library.
- `docs/AI-PLACEMENT.md` instructions handed to a Claude instance during the placement round trip.

## Core invariants

- Stored chords are always SOUNDING chords. Capo is a pure display transform: displayed shape = sounding chord transposed down capo semitones. The header renders like "Key: Eb, Capo 3" and the sounding key never changes when capo changes.
- Chord entry while capo > 0 is in shape space (what you see is what you type); the editor converts up by capo semitones before storing.
- Transpose rewrites stored sounding chords (a real key change). It is a separate control from capo; both exist on purpose.
- Enharmonic spelling: displayed shapes follow the shaped key (sounding key minus capo); the header and capo-0 chords follow the sounding key. Flat keys spell flat, sharp keys spell sharp.
- Alignment is character-cell based: monospace font, chord at column col sits at `left: col * 1ch`. Print output is literal text rows built by `buildChordRow`, never positioned elements.
- Import accepts placements by column or by anchor substring; anchors are resolved deterministically by `resolveAnchor`. Import review only ever accepts the placements array; lyric changes in imported JSON are rejected.

## Conventions

- No em dashes anywhere, in code, comments, docs, or UI copy. Use commas, periods, or parentheses. Semicolons are fine in code, not in prose.
- Public writing style, for README, BUILDLOG, issues, commit messages, and UI copy: no semicolons in prose, no LLM-isms, no hype adjectives, metrics instead of claims, shortcomings stated plainly.
- A wall-clock number appears only next to its verification cost (issue count, review trail, correction loop). Never a speed claim on its own.
- In anything public, song titles are fine. Lyric lines and chord annotations on copyrighted songs never are. Use the demo set for every example, including in issues and commit messages.
- Work happens on a branch in a Conductor workspace, one issue per branch, target `origin/main`. Every change lands through a PR, even a one commit change, for the paper trail: `gh pr create --base main`, then merge with a merge commit, never a squash, so the checkpoint commits survive. A commit closes its issue with "closes #N". Nothing is real until it is merged and pushed.
- Never use bare `git stash` or `git stash pop`, because the stash stack is shared across every worktree. Prefer a temporary WIP commit. If a stash is unavoidable, use `git stash push -u -m "<tag>"` and restore with `git stash apply <sha>`.
- The engine stays pure: no DOM, no React, no side effects; every branch table-tested.
- Lyrics in the repo must be public domain. The demo set is the only lyric content that belongs here.
- Screenshots are never stored in the tool, the repo, or song files.
- Jamie's personal song library is out of scope. Where it lives, how it is backed up, and whether any archive of it has been unpacked are personal setup, not repo concerns. Do not audit it, do not report on it, and do not raise it as a risk or a loose end. The repo's only obligation is that no copyrighted lyric or chord annotation is tracked in it.
