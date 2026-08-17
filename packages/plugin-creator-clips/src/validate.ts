/**
 * creator-clips workflow validation (CREATOR-007).
 *
 * RED: invalid time range -> fail; start >= end -> fail; segment outside
 * duration -> fail; batch output collision -> fail.
 */
import type { TimestampArg } from "./types.js";

/**
 * Parse a timestamp argument: a non-negative number of seconds or an
 * "mm:ss" / "mm:ss.mmm" (or bare seconds) string. Returns undefined for
 * anything malformed or negative.
 */
export function parseTimestamp(value: TimestampArg): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^(\d{1,3}):([0-5]\d)(?:\.(\d{1,3}))?$/);
  if (m) {
    return Number(m[1]) * 60 + Number(m[2]) + Number(m[3] ?? 0) / 1000;
  }
  return undefined;
}

export type RangeResult =
  | { ok: true; start: number; end: number; duration: number }
  | { ok: false; message: string };

/**
 * Validate a clip range: both ends must parse, start >= 0, and end > start.
 */
export function validateRange(start: TimestampArg, end: TimestampArg): RangeResult {
  const s = parseTimestamp(start);
  const e = parseTimestamp(end);
  if (s === undefined || e === undefined) {
    return { ok: false, message: "start and end must be non-negative seconds or mm:ss" };
  }
  if (s >= e) return { ok: false, message: `start (${s}s) must be before end (${e}s)` };
  return { ok: true, start: s, end: e, duration: e - s };
}

/**
 * Reject a clip range that extends beyond the media duration.
 */
export function withinDuration(
  range: { end: number },
  mediaDuration: number,
  tolerance = 0.001,
): { ok: true } | { ok: false; message: string } {
  if (range.end > mediaDuration + tolerance) {
    return {
      ok: false,
      message: `segment end (${range.end}s) exceeds media duration (${mediaDuration}s)`,
    };
  }
  return { ok: true };
}

/**
 * Detect duplicate output paths in a batch (output collision -> fail).
 */
export function detectBatchCollisions(
  outputs: readonly string[],
): { ok: true } | { ok: false; message: string } {
  const seen = new Set<string>();
  for (const out of outputs) {
    if (seen.has(out)) {
      return { ok: false, message: `batch output collision: ${out}` };
    }
    seen.add(out);
  }
  return { ok: true };
}
