/**
 * creator-transcribe providers (CREATOR-006).
 *
 * RED: `createTranscribeProvider` is a stub — it throws "not implemented".
 * GREEN wires the deterministic mock and the Whisper-compatible provider.
 */
import type {
  Transcript,
  TranscriptSegment,
  TranscribeProviderKind,
} from "./types.js";

export interface TranscribeProvider {
  readonly kind: TranscribeProviderKind;
  transcribe(options: { audioPath: string; language?: string }): Promise<Transcript>;
}

/** Build a provider by kind (mock / whisper). */
export function createTranscribeProvider(
  _kind: TranscribeProviderKind,
): TranscribeProvider {
  throw new Error("not implemented: createTranscribeProvider");
}

/** Deterministic mock segments (stub). */
export function mockSegments(_audioPath: string): TranscriptSegment[] {
  throw new Error("not implemented: mockSegments");
}
