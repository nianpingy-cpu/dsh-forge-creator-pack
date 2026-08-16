/**
 * creator-transcribe subtitle rendering (CREATOR-006).
 *
 * RED: renderers are stubs — they throw "not implemented". Tests are
 * failing. GREEN emits valid SRT / VTT / ASS.
 */
import type { TranscriptSegment } from "./types.js";

function notImplemented(name: string): never {
  throw new Error(`not implemented: ${name}`);
}

/** Render SRT (cue syntax HH:MM:SS,mmm --> HH:MM:SS,mmm). */
export function toSrt(_segments: readonly TranscriptSegment[]): string {
  return notImplemented("toSrt");
}

/** Render WebVTT (must start with the WEBVTT header). */
export function toVtt(_segments: readonly TranscriptSegment[]): string {
  return notImplemented("toVtt");
}

/** Render ASS (Script Info + Dialogue events). */
export function toAss(_segments: readonly TranscriptSegment[]): string {
  return notImplemented("toAss");
}
