/**
 * creator-clips plugin (CREATOR-007) — RED stubs.
 *
 * High-level creator-workflow clipping that composes the carried-in ffmpeg
 * adapter. The tools below are not implemented yet; tests are failing.
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

export const creatorClipsPlugin: Plugin = {
  metadata: {
    name: "@dsh-forge-creator/plugin-creator-clips",
    version: "0.1.0",
    upstreamTool: "ffmpeg (via carried-in @dsh-forge-creator/plugin-ffmpeg)",
    coreContractVersion: CORE_VERSION,
    capabilities: [
      "clip_by_time",
      "clip_by_chapter",
      "clip_by_transcript",
      "remove_silence",
      "make_vertical",
      "make_square",
      "batch_clip",
      "merge_segments",
    ],
  },
  tools: [
    stub("clip_by_time", "workspace-write"),
    stub("clip_by_chapter", "workspace-write"),
    stub("clip_by_transcript", "workspace-write"),
    stub("remove_silence", "workspace-write"),
    stub("make_vertical", "workspace-write"),
    stub("make_square", "workspace-write"),
    stub("batch_clip", "workspace-write"),
    stub("merge_segments", "workspace-write"),
  ],
};

export default creatorClipsPlugin;
