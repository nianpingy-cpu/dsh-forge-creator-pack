/**
 * creator-publish plugin (CREATOR-013) — RED stubs.
 *
 * Controlled multi-platform publishing. The tools below are not implemented
 * yet; tests are failing.
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

export const publishPlugin: Plugin = {
  metadata: {
    name: "@dsh-forge-creator/plugin-creator-publish",
    version: "0.1.0",
    upstreamTool: "Postiz-compatible (AGPL-3.0, external API adapter)",
    coreContractVersion: CORE_VERSION,
    capabilities: [
      "publisher_accounts",
      "publisher_capabilities",
      "post_validate",
      "post_preview",
      "post_create_draft",
      "post_schedule",
      "post_publish",
      "post_status",
      "post_cancel_schedule",
    ],
  },
  tools: [
    stub("publisher_accounts", "read"),
    stub("publisher_capabilities", "read"),
    stub("post_validate", "read"),
    stub("post_preview", "read"),
    stub("post_create_draft", "workspace-write"),
    stub("post_schedule", "network"),
    stub("post_publish", "network"),
    stub("post_status", "read"),
    stub("post_cancel_schedule", "network"),
  ],
};

export default publishPlugin;
