/**
 * creator-transcribe segment pipeline (CREATOR-006).
 *
 * GREEN: timestamp validation (monotonic, end >= start), chapter detection
 * and heuristic language detection.
 */
import type {
  Chapter,
  SegmentResult,
  TranscriptSegment,
} from "./types.js";

/**
 * Validate segments: timestamps monotonic increasing (non-decreasing),
 * end >= start. Returns typed errors, never a crash.
 */
export function normalizeSegments(
  segments: readonly TranscriptSegment[],
): SegmentResult {
  if (!Array.isArray(segments)) {
    return { ok: false, errors: ["segments must be an array"] };
  }
  const errors: string[] = [];
  let prevEnd = -1;
  segments.forEach((segment, index) => {
    const prefix = `segment ${index}`;
    if (
      typeof segment.startMs !== "number" ||
      !Number.isFinite(segment.startMs) ||
      segment.startMs < 0
    ) {
      errors.push(`${prefix}: startMs must be a non-negative number`);
      return;
    }
    if (typeof segment.endMs !== "number" || !Number.isFinite(segment.endMs)) {
      errors.push(`${prefix}: endMs must be a number`);
      return;
    }
    if (segment.endMs < segment.startMs) {
      errors.push(`${prefix}: endMs (${segment.endMs}) < startMs (${segment.startMs})`);
    }
    if (segment.startMs < prevEnd) {
      errors.push(
        `${prefix}: startMs (${segment.startMs}) is not monotonic (previous end ${prevEnd})`,
      );
    }
    prevEnd = segment.endMs;
  });
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, segments: [...segments] };
}

function truncate(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Detect chapters by grouping segments (gap > 1500ms starts a new chapter). */
export function detectChapters(
  segments: readonly TranscriptSegment[],
): Chapter[] {
  const chapters: Chapter[] = [];
  if (segments.length === 0) return chapters;
  let current: Chapter = {
    startMs: segments[0]!.startMs,
    endMs: segments[0]!.endMs,
    title: truncate(segments[0]!.text),
  };
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i]!;
    if (segment.startMs - current.endMs > 1500) {
      chapters.push(current);
      current = {
        startMs: segment.startMs,
        endMs: segment.endMs,
        title: truncate(segment.text),
      };
    } else {
      current.endMs = Math.max(current.endMs, segment.endMs);
    }
  }
  chapters.push(current);
  return chapters;
}

/** Heuristic language detection (zh / en / unknown). */
export function detectLanguage(text: string): string {
  let cjk = 0;
  let latin = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf)
    ) {
      cjk++;
    } else if (/[a-zA-Z]/.test(ch)) {
      latin++;
    }
  }
  if (cjk > 0 && cjk >= latin) return "zh";
  if (latin > 0) return "en";
  return "unknown";
}

