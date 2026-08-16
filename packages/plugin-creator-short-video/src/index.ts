/**
 * creator-short-video plugin (CREATOR-008) — RED stubs.
 *
 * Topic/script -> short-video job adapter. The tools below are not
 * implemented yet; tests are failing.
 */
import type { Plugin, ToolDefinition } from "@dsh-forge-creator/core";

const CORE_VERSION = "0.1.0" as const;

function notImplemented(): never {
  throw new Error("not implemented");
}

function stub(name: string, mutationClass: ToolDefinition["mutationClass"]): ToolDefinition {
  return {
    name,
    description: `${name} (RED stub)`,
    mutationClass,
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async () => {
      notImplemented();
    },
  };
}

export const shortVideoPlugin: Plugin = {
  metadata: {
    name: "@dsh-forge-creator/plugin-creator-short-video",
    version: "0.1.0",
    upstreamTool: "MoneyPrinterTurbo-compatible (MIT, external provider adapter)",
    coreContractVersion: CORE_VERSION,
    capabilities: [
      "short_video_plan",
      "short_video_generate",
      "short_video_status",
      "short_video_assets",
      "short_video_preview",
    ],
  },
  tools: [
    stub("short_video_plan", "read"),
    stub("short_video_generate", "workspace-write"),
    stub("short_video_status", "read"),
    stub("short_video_assets", "read"),
    stub("short_video_preview", "read"),
  ],
};

export default shortVideoPlugin;
