/**
 * creator-localize plugin (CREATOR-011) — RED stubs.
 *
 * Subtitle & video localization workflow. The tools below are not
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

export const localizePlugin: Plugin = {
  metadata: {
    name: "@dsh-forge-creator/plugin-creator-localize",
    version: "0.1.0",
    upstreamTool: "VideoLingo-compatible (Apache-2.0, external provider adapter)",
    coreContractVersion: CORE_VERSION,
    capabilities: [
      "subtitle_translate",
      "subtitle_align",
      "subtitle_resegment",
      "localize_video",
      "dub_video",
      "localize_preview",
    ],
  },
  tools: [
    stub("subtitle_translate", "workspace-write"),
    stub("subtitle_align", "workspace-write"),
    stub("subtitle_resegment", "workspace-write"),
    stub("localize_video", "workspace-write"),
    stub("dub_video", "workspace-write"),
    stub("localize_preview", "read"),
  ],
};

export default localizePlugin;
