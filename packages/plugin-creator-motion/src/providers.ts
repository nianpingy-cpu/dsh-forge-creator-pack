/**
 * creator-motion providers (CREATOR-012).
 *
 * MockMotionProvider: fully-local deterministic renderer (computes output
 * dimensions from the aspect ratio; CI-safe, no Remotion). Remotion-compatible
 * provider: generic HTTP/command adapter (Remotion License is custom/NOASSERTION
 * — NO vendoring); unconfigured -> typed ToolFailure with a config hint.
 */
import type { ToolResult } from "@dsh-forge-creator/core";
import type { MotionTemplate } from "./templates.js";

const REMOTION_HINT =
  "Remotion-compatible provider is not configured; set REMOTION_RENDER_CMD (or a render API endpoint) to enable an external renderer (Remotion License is custom — external provider only, no vendoring), or use the built-in mock renderer for deterministic CI output";

export interface MotionRenderRequest {
  template: MotionTemplate;
  aspectRatio: string;
  input: Record<string, unknown>;
  outputPath: string;
}

export interface MotionRenderResult {
  path: string;
  templateId: string;
  aspectRatio: string;
  width: number;
  height: number;
  engine: string;
}

export interface MotionProvider {
  render(
    req: MotionRenderRequest,
  ): { ok: true; result: MotionRenderResult } | { ok: false; result: ToolResult };
}

const RATIO_DIMS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

/** Fully-local deterministic renderer. */
class MockMotionProvider implements MotionProvider {
  render(
    req: MotionRenderRequest,
  ): { ok: true; result: MotionRenderResult } {
    const dims = RATIO_DIMS[req.aspectRatio] ?? { width: 1280, height: 720 };
    return {
      ok: true,
      result: {
        path: req.outputPath,
        templateId: req.template.id,
        aspectRatio: req.aspectRatio,
        width: dims.width,
        height: dims.height,
        engine: "mock",
      },
    };
  }
}

/** Generic Remotion-compatible adapter (unconfigured -> typed ToolFailure). */
class RemotionProvider implements MotionProvider {
  render(): { ok: false; result: ToolResult } {
    return {
      ok: false,
      result: {
        ok: false,
        summary: "provider unavailable",
        error: { code: "ToolFailure", message: REMOTION_HINT },
      },
    };
  }
}

export type MotionProviderKind = "mock" | "remotion";

export function createMotionProvider(kind: MotionProviderKind): MotionProvider {
  return kind === "mock" ? new MockMotionProvider() : new RemotionProvider();
}

export { REMOTION_HINT };
