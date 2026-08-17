/**
 * creator-transcribe domain types (CREATOR-006).
 */
export type TranscribeProviderKind = "mock" | "whisper";

export interface TranscriptSegment {
  id: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface Transcript {
  segments: TranscriptSegment[];
  language?: string;
  source: string;
  provider: TranscribeProviderKind;
}

export interface Chapter {
  startMs: number;
  endMs: number;
  title: string;
}

export type SubtitleFormat = "srt" | "vtt" | "ass";

export type SegmentResult =
  | { ok: true; segments: TranscriptSegment[] }
  | { ok: false; errors: string[] };
