/**
 * creator-transcribe segment pipeline (CREATOR-006).
 *
 * RED: helpers below are stubs — they throw "not implemented". Tests are
 * failing. GREEN validates timestamps, detects chapters/language and renders
 * subtitles.
 */
import type {
  Chapter,
  SegmentResult,
  TranscriptSegment,
} from "./types.js";

function notImplemented(name: string): never {
  throw new Error(`not implemented: ${name}`);
}

/**
 * Validate segments: timestamps monotonic increasing, end >= start.
 * Returns typed errors, never a crash.
 */
export function normalizeSegments(
  _segments: readonly TranscriptSegment[],
): SegmentResult {
  return notImplemented("normalizeSegments");
}

/** Detect chapters by grouping segments (gap-based, deterministic). */
export function detectChapters(
  _segments: readonly TranscriptSegment[],
): Chapter[] {
  return notImplemented("detectChapters");
}

/** Heuristic language detection (zh / en / unknown). */
export function detectLanguage(_text: string): string {
  return notImplemented("detectLanguage");
}
