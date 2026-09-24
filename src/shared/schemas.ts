import { z } from "zod";

export const chordPlacementSchema = z.object({
  id: z.string().min(1),
  line: z.number().int().min(0),
  col: z.number().int().min(0),
  chord: z.string().min(1),
  hold: z.boolean().optional(),
});

export const sectionMarkSchema = z.object({
  section: z.string().min(1),
  occurrence: z.number().int().min(1),
  kind: z.enum(["tacet", "soft", "build", "full", "custom"]),
  text: z.string().optional(),
  color: z.enum(["red", "blue", "amber", "green"]).optional(),
});

export const arrangementStepSchema = z.object({
  section: z.string(),
  occurrence: z.number().int().min(1),
  repeat: z.number().int().min(1).max(16).optional(),
  note: z.string().optional(),
  mark: sectionMarkSchema.pick({ kind: true, text: true, color: true }).nullable().optional(),
});

export const arrangementSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  steps: z.array(arrangementStepSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const songSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().optional(),
  lyrics: z.array(z.string()),
  placements: z.array(chordPlacementSchema),
  keyOverride: z.string().nullable(),
  capo: z.number().int().min(0).max(9),
  bpm: z.number().int().min(20).max(400).optional(),
  notes: z.string().optional(),
  sectionMarks: z.array(sectionMarkSchema).optional(),
  arrangements: z.array(arrangementSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const setEntrySchema = z.object({
  songId: z.string().min(1),
  arrangementId: z.string().min(1).optional(),
});

/** Sets saved before arrangements stored a bare songIds array; read those as entries. */
function upgradeLegacySet(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const { songIds, ...rest } = raw as { songIds?: unknown; entries?: unknown };
  if (rest.entries !== undefined || !Array.isArray(songIds)) return raw;
  return { ...rest, entries: songIds.map((songId) => ({ songId })) };
}

export const setlistSchema = z.preprocess(
  upgradeLegacySet,
  z.object({
    version: z.literal(1),
    id: z.string().min(1),
    name: z.string().min(1),
    entries: z.array(setEntrySchema),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);

/** Col-form placement as it may arrive from outside; id is optional there. */
export const importedColPlacementSchema = z.object({
  id: z.string().optional(),
  line: z.number().int().min(0),
  col: z.number().int().min(0),
  chord: z.string().min(1),
  hold: z.boolean().optional(),
});

/**
 * Anchor-form placement: position given as a short substring quoted from the
 * lyric line. Exists because models miscount offsets but quote reliably.
 */
export const importedAnchorPlacementSchema = z.object({
  line: z.number().int().min(0),
  chord: z.string().min(1),
  anchor: z.string().min(1),
  anchorOccurrence: z.number().int().min(1).optional(),
  offsetInAnchor: z.number().int().min(0).optional(),
  hold: z.boolean().optional(),
});

export const importedPlacementSchema = z.union([
  importedColPlacementSchema,
  importedAnchorPlacementSchema,
]);

export const importedSongSchema = songSchema.extend({
  placements: z.array(importedPlacementSchema),
});
