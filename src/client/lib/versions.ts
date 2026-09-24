import type { Arrangement, ArrangementStep, MarkKind, SectionMark, SetEntry, Song } from "../../shared/types";
import { arrangeableSections, resolveStep } from "./arrangement";
import { markFor } from "./sectionMarks";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 24 version": the name a new version starts with, from the local date. */
export function defaultVersionName(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()} version`;
}

/** The arrangement with this id, or null for the song as written or an unknown id. */
export function findArrangement(song: Song, id: string | null | undefined): Arrangement | null {
  if (id === null || id === undefined) return null;
  return song.arrangements?.find((a) => a.id === id) ?? null;
}

/** "Title (Version name)" for a set entry, plain "Title" as written, null when the song is gone. */
export function entryTitle(songs: Song[], entry: SetEntry | undefined): string | null {
  if (!entry) return null;
  const song = songs.find((s) => s.id === entry.songId);
  if (!song) return null;
  const version = findArrangement(song, entry.arrangementId);
  return version ? `${song.title} (${version.name})` : song.title;
}

/** "1 version", "3 versions". */
export function versionCount(n: number): string {
  return `${n} version${n === 1 ? "" : "s"}`;
}

/** The mark select's value for a step: inherit the section's, none, or a mark kind. */
export type MarkChoice = "inherit" | "none" | MarkKind;

export function markChoice(mark: ArrangementStep["mark"]): MarkChoice {
  if (mark === undefined) return "inherit";
  if (mark === null) return "none";
  return mark.kind;
}

/** Back from the select. Custom keeps the step's own text and color; presets carry neither. */
export function markFromChoice(choice: MarkChoice, current: ArrangementStep["mark"]): ArrangementStep["mark"] {
  if (choice === "inherit") return undefined;
  if (choice === "none") return null;
  if (choice === "custom") return current?.kind === "custom" ? current : { kind: "custom", color: "amber" };
  return { kind: choice };
}

/** The mark a step shows when it inherits: its own section's, else the section it borrows. */
export function inheritedMark(song: Song, step: ArrangementStep): SectionMark | null {
  const marks = song.sectionMarks ?? [];
  const own = markFor(marks, step.section, step.occurrence);
  if (own) return own;
  const source = resolveStep(arrangeableSections(song), step);
  return source ? markFor(marks, source.section, source.occurrence) : null;
}
