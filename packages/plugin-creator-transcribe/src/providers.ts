/**
 * creator-transcribe providers (CREATOR-006).
 *
 * GREEN: deterministic mock provider for CI. The whisper path is executed
 * directly by the tools through ctx.run (external binary); the provider
 * factory serves the mock.
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

/** Deterministic mock segments (license-safe fixture transcript). */
export function mockSegments(): TranscriptSegment[] {
  return [
    { id: 0, startMs: 0, endMs: 1200, text: "大家好" },
    { id: 1, startMs: 1400, endMs: 3000, text: "欢迎收看本期 AI 科普" },
    { id: 2, startMs: 3200, endMs: 4500, text: "今天我们聊聊大模型" },
  ];
}

/** Build a provider by kind (mock for CI; whisper runs via ctx.run in tools). */
export function createTranscribeProvider(
  kind: TranscribeProviderKind,
): TranscribeProvider {
  switch (kind) {
    case "mock":
      return {
        kind,
        async transcribe(options) {
          return {
            segments: mockSegments(),
            language: "zh",
            source: options.audioPath,
            provider: "mock",
          };
        },
      };
    case "whisper":
      throw new Error(
        "whisper provider is executed by the tool binary path (ctx.run); use provider=whisper on the tool, not the factory",
      );
    default:
      throw new Error(`unsupported transcribe provider kind: ${kind}`);
  }
}

