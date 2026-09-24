import type { Song } from "../../shared/types";
import { normalizeSections, stripPageLines } from "./normalize";
import { extractLabelNotes } from "./sectionMarks";
import { repairChordTextLines } from "./tabPaste";

export interface CleanResult {
  song: Song;
  changed: boolean;
  /** Chord rows stored as lyric text that became placements. */
  chordLinesConverted: number;
  /** Inline label notes promoted to section marks. */
  labelNotesPromoted: number;
}

/**
 * The stored-song fix-up shared by the app's load-time migration and the
 * repair-songs script: page artifacts stripped, chord rows stuck as text
 * repaired, section spacing normalized, label notes promoted. updatedAt is
 * never touched, so browser and disk copies transform identically. An
 * unchanged song comes back as the same object.
 */
export function cleanSong(song: Song): CleanResult {
  const stripped = stripPageLines(song.lyrics, song.placements);
  const repaired = repairChordTextLines(stripped.lyrics, stripped.placements);
  const n = normalizeSections(repaired.lyrics, repaired.placements);
  const extracted = extractLabelNotes(n.lyrics, song.sectionMarks ?? []);
  const changed = stripped.changed || repaired.changed || n.changed || extracted.changed;
  return {
    song: changed
      ? {
          ...song,
          lyrics: extracted.lyrics,
          placements: n.placements,
          sectionMarks: extracted.sectionMarks.length > 0 ? extracted.sectionMarks : song.sectionMarks,
        }
      : song,
    changed,
    chordLinesConverted: repaired.converted,
    labelNotesPromoted: extracted.converted,
  };
}
