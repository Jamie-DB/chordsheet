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
- `songs/` exported song JSON files, committed to this private repo. The browser's localStorage holds the working copy; export/import moves songs between the two.
- `docs/AI-PLACEMENT.md` instructions handed to a Claude instance during the placement round trip.

## Core invariants

- Stored chords are always SOUNDING chords. Capo is a pure display transform: displayed shape = sounding chord transposed down capo semitones. The header renders like "Key: Eb, Capo 3" and the sounding key never changes when capo changes.
- Chord entry while capo > 0 is in shape space (what you see is what you type); the editor converts up by capo semitones before storing.
- Transpose rewrites stored sounding chords (a real key change). It is a separate control from capo; both exist on purpose.
- Enharmonic spelling: displayed shapes follow the shaped key (sounding key minus capo); the header and capo-0 chords follow the sounding key. Flat keys spell flat, sharp keys spell sharp.
- Alignment is character-cell based: monospace font, chord at column col sits at `left: col * 1ch`. Print output is literal text rows built by `buildChordRow`, never positioned elements.
- Import accepts placements by column or by anchor substring; anchors are resolved deterministically by `resolveAnchor`. Import review only ever accepts the placements array; lyric changes in imported JSON are rejected.

## Conventions

- No em dashes anywhere, in code, comments, docs, or UI copy. Use commas, periods, semicolons, or parentheses.
- Work on main; commit at phase checkpoints (see the phase issues on GitHub).
- The engine stays pure: no DOM, no React, no side effects; every branch table-tested.
- Lyrics in the repo must be public domain (the seed song is Amazing Grace).
- Screenshots are never stored in the tool, the repo, or song files.
