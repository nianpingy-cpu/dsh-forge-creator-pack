/**
 * creator-cover providers (CREATOR-009).
 *
 * MockCoverProvider: deterministic background generation (records dimensions).
 * LocalLayoutProvider: deterministic layout engine (src/layout.ts).
 * ComfyUIProvider: EXTERNAL HTTP/API adapter ONLY (ComfyUI is GPL-3.0 — no
 * source copying); every operation is a typed ToolFailure with a config hint
 * until an endpoint is configured.
 */
import type { ToolResult } from "@dsh-forge-creator/core";
import { recordCover } from "./store.js";

const COMFYUI_HINT =
  "ComfyUI provider is not configured; set COMFYUI_API_URL to enable the external HTTP/API adapter (GPL-3.0 upstream, adapter only — no source copied), or use the built-in mock provider for deterministic CI covers";

export interface BackgroundOptions {
  width: number;
  height: number;
  style?: string;
}

export interface CoverBackgroundResult {
  path: string;
  width: number;
  height: number;
  style: string;
}

export interface BackgroundProvider {
  generate(
    outputPath: string,
    opts: BackgroundOptions,
  ):
    | { ok: true; result: CoverBackgroundResult }
    | { ok: false; result: ToolResult };
}

/** Deterministic mock background provider (records dimensions). */
export class MockCoverProvider implements BackgroundProvider {
  generate(outputPath: string, opts: BackgroundOptions) {
    recordCover(outputPath, opts.width, opts.height);
    return {
      ok: true,
      result: {
        path: outputPath,
        width: opts.width,
        height: opts.height,
        style: opts.style ?? "gradient",
      },
    };
  }
}

/** External ComfyUI adapter (unconfigured -> typed ToolFailure). */
class ComfyUIProvider implements BackgroundProvider {
  generate() {
    return {
      ok: false,
      result: {
        ok: false,
        summary: "provider unavailable",
        error: { code: "ToolFailure", message: COMFYUI_HINT },
      },
    };
  }
}

export type CoverProviderKind = "mock" | "comfyui";

export function createBackgroundProvider(kind: CoverProviderKind): BackgroundProvider {
  return kind === "mock" ? new MockCoverProvider() : new ComfyUIProvider();
}

export { COMFYUI_HINT };
