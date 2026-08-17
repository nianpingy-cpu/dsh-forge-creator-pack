/**
 * creator-clips domain types (CREATOR-007).
 *
 * All ranges are in seconds (or "mm:ss" strings in tool args). creator-clips
 * only exposes high-level workflows — never free-form FFmpeg parameter
 * strings.
 */
export interface ClipRange {
  /** Start time in seconds. */
  start: number;
  /** End time in seconds (must be > start). */
  end: number;
}

export interface ChapterRef extends ClipRange {
  /** Optional human-readable chapter name. */
  name?: string;
}

export interface TranscriptSegmentRef extends ClipRange {
  /** Optional segment text (informational). */
  text?: string;
}

export interface BatchClipItem {
  input: string;
  start: number;
  end: number;
  output: string;
  overwrite?: boolean;
}

export type TimestampArg = number | string;
