/**
 * creator-voice plugin (CREATOR-010) — RED stubs.
 *
 * Licensed TTS / voice clone. The tools below are not implemented yet; tests
 * are failing.
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

export const voicePlugin: Plugin = {
  metadata: {
    name: "@dsh-forge-creator/plugin-creator-voice",
    version: "0.1.0",
    upstreamTool: "OpenVoice-compatible (external provider adapter)",
    coreContractVersion: CORE_VERSION,
    capabilities: [
      "voice_register_reference",
      "voice_list",
      "tts_generate",
      "voice_clone",
      "voice_style_transfer",
      "voice_preview",
    ],
  },
  tools: [
    stub("voice_register_reference", "workspace-write"),
    stub("voice_list", "read"),
    stub("tts_generate", "workspace-write"),
    stub("voice_clone", "workspace-write"),
    stub("voice_style_transfer", "workspace-write"),
    stub("voice_preview", "read"),
  ],
};

export default voicePlugin;
