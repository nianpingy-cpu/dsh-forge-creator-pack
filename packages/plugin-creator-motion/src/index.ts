/**
 * creator-motion plugin (CREATOR-012) — RED stubs.
 *
 * Templated, verifiable programmatic video rendering. The tools below are not
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

export const motionPlugin: Plugin = {
  metadata: {
    name: "@dsh-forge-creator/plugin-creator-motion",
    version: "0.1.0",
    upstreamTool: "Remotion-compatible (custom license, generic HTTP/command provider; no vendoring)",
    coreContractVersion: CORE_VERSION,
    capabilities: [
      "motion_templates",
      "motion_inspect_template",
      "motion_render",
      "motion_render_variants",
      "motion_preview",
    ],
  },
  tools: [
    stub("motion_templates", "read"),
    stub("motion_inspect_template", "read"),
    stub("motion_render", "workspace-write"),
    stub("motion_render_variants", "workspace-write"),
    stub("motion_preview", "read"),
  ],
};

export default motionPlugin;
