/**
 * creator-cover in-memory image record (CREATOR-009).
 *
 * The mock providers "produce" images by recording their workspace-relative
 * path and dimensions, so cover_validate can deterministically verify
 * dimensions in CI without real image decoding.
 */
export interface CoverRecord {
  width: number;
  height: number;
}

const records = new Map<string, CoverRecord>();

// Pre-seeded sample record (a "fixture" cover at x-image dimensions) so
// stateless cover_validate checks in the contract suite are deterministic.
recordCover("fixture.png", 1600, 900);

/** Record a produced cover's dimensions (workspace-relative path). */
export function recordCover(path: string, width: number, height: number): void {
  records.set(path, { width, height });
}

/** Look up a produced cover's dimensions; undefined when unknown. */
export function getCover(path: string): CoverRecord | undefined {
  return records.get(path);
}
