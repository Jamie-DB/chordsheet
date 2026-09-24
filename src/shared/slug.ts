/**
 * Title to song or setlist id: lowercase ASCII words joined by hyphens,
 * apostrophes dropped so "Grace's" stays one word, "song" when nothing survives, and a numeric suffix when the id is taken.
 * Pure, shared by the app and the PDF ingest so both mint the same ids.
 */
export function slugify(title: string, taken: Set<string>): string {
  const base =
    title
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "song";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
