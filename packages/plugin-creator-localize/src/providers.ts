/**
 * creator-localize providers (CREATOR-011).
 *
 * MockLocalizeProvider: deterministic translation (prefixes target-language
 * marker; timestamps preserved). VideoLingo-compatible provider: EXTERNAL
 * adapter (Apache-2.0 upstream, no vendoring); unconfigured -> typed
 * ToolFailure with a config hint.
 */
import type { ToolResult } from "@dsh-forge-creator/core";

const VIDEOLINGO_HINT =
  "VideoLingo-compatible provider is not configured; set VIDEOLINGO_API_URL (or VIDEOLINGO_CLI) to enable it, or use the built-in mock provider for deterministic CI localization";

export interface TranslateRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslateResult {
  text: string;
  provider: "mock" | "videolingo";
}

export interface LocalizeProvider {
  translate(
    req: TranslateRequest,
  ): { ok: true; result: TranslateResult } | { ok: false; result: ToolResult };
}

/** Deterministic mock translation (prefixes a target-language marker). */
class MockLocalizeProvider implements LocalizeProvider {
  translate(req: TranslateRequest): { ok: true; result: TranslateResult } {
    return {
      ok: true,
      result: {
        text: `[${req.targetLanguage}] ${req.text}`,
        provider: "mock",
      },
    };
  }
}

/** External VideoLingo-compatible adapter (unconfigured -> typed ToolFailure). */
class VideoLingoProvider implements LocalizeProvider {
  translate(): { ok: false; result: ToolResult } {
    return {
      ok: false,
      result: {
        ok: false,
        summary: "provider unavailable",
        error: { code: "ToolFailure", message: VIDEOLINGO_HINT },
      },
    };
  }
}

export type LocalizeProviderKind = "mock" | "videolingo";

export function createLocalizeProvider(kind: LocalizeProviderKind): LocalizeProvider {
  return kind === "mock" ? new MockLocalizeProvider() : new VideoLingoProvider();
}

export { VIDEOLINGO_HINT };
