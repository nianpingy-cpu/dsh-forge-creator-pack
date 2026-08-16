/**
 * creator-cover plugin (CREATOR-009) — RED stubs.
 *
 * Platform-ready cover generation. The tools below are not implemented yet;
 * tests are failing.
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

export const coverPlugin: Plugin = {
  metadata: {
    name: "@dsh-forge-creator/plugin-creator-cover",
    version: "0.1.0",
    upstreamTool: "ComfyUI-compatible (GPL-3.0, external HTTP/API adapter only)",
    coreContractVersion: CORE_VERSION,
    capabilities: [
      "cover_generate_background",
      "cover_layout",
      "cover_add_title",
      "cover_add_subject",
      "cover_resize",
      "cover_variants",
      "cover_validate",
    ],
  },
  tools: [
    stub("cover_generate_background", "workspace-write"),
    stub("cover_layout", "read"),
    stub("cover_add_title", "workspace-write"),
    stub("cover_add_subject", "workspace-write"),
    stub("cover_resize", "workspace-write"),
    stub("cover_variants", "workspace-write"),
    stub("cover_validate", "read"),
  ],
};

export default coverPlugin;
