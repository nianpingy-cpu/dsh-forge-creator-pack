/**
 * creator-voice providers (CREATOR-010).
 *
 * MockVoiceProvider: deterministic synthetic voice output (CI-safe; never
 * real public-figure voices). OpenVoice-compatible provider: EXTERNAL adapter
 * (no vendoring); unconfigured -> typed ToolFailure with a config hint.
 */
import type { ToolResult } from "@dsh-forge-creator/core";

const OPENVOICE_HINT =
  "OpenVoice-compatible provider is not configured; set OPENVOICE_API_URL (or OPENVOICE_CLI) to enable it, or use the built-in mock provider for deterministic CI voice (synthetic only)";

export interface VoiceGenerateOptions {
  outputPath: string;
  text: string;
  referenceId?: string;
}

export interface VoiceOutput {
  path: string;
  kind: "tts" | "clone" | "style-transfer";
  referenceId?: string;
}

export interface VoiceProvider {
  generate(
    opts: VoiceGenerateOptions,
    kind: VoiceOutput["kind"],
  ): { ok: true; result: VoiceOutput } | { ok: false; result: ToolResult };
}

/** Deterministic synthetic mock (records nothing; returns the output path). */
class MockVoiceProvider implements VoiceProvider {
  generate(
    opts: VoiceGenerateOptions,
    kind: VoiceOutput["kind"],
  ): { ok: true; result: VoiceOutput } {
    return {
      ok: true,
      result: {
        path: opts.outputPath,
        kind,
        referenceId: opts.referenceId,
      },
    };
  }
}

/** External OpenVoice-compatible adapter (unconfigured -> typed ToolFailure). */
class OpenVoiceProvider implements VoiceProvider {
  generate(): { ok: false; result: ToolResult } {
    return {
      ok: false,
      result: {
        ok: false,
        summary: "provider unavailable",
        error: { code: "ToolFailure", message: OPENVOICE_HINT },
      },
    };
  }
}

export function createVoiceProvider(kind: VoiceProviderKindLike): VoiceProvider {
  return kind === "mock" ? new MockVoiceProvider() : new OpenVoiceProvider();
}

export type VoiceProviderKindLike = "mock" | "openvoice";

export { OPENVOICE_HINT };
