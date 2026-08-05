import { z } from "zod";

export const chordPlacementSchema = z.object({
  id: z.string().min(1),
  line: z.number().int().min(0),
  col: z.number().int().min(0),
  chord: z.string().min(1),
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
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Col-form placement as it may arrive from outside; id is optional there. */
export const importedColPlacementSchema = z.object({
  id: z.string().optional(),
  line: z.number().int().min(0),
  col: z.number().int().min(0),
  chord: z.string().min(1),
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
});

export const importedPlacementSchema = z.union([
  importedColPlacementSchema,
  importedAnchorPlacementSchema,
]);

export const importedSongSchema = songSchema.extend({
  placements: z.array(importedPlacementSchema),
});

export type ImportedPlacement = z.infer<typeof importedPlacementSchema>;
export type ImportedSong = z.infer<typeof importedSongSchema>;
