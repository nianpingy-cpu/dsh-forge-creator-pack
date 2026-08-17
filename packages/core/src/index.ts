/**
 * Semantic version of the @dsh-forge-creator/core package (adapted from
 * @dsh-forge/core, MIT).
 *
 * Plugins should report this version in their compatibility metadata so the
 * DeepSeek Harness host can reason about which core contract a plugin targets.
 */
export const CORE_VERSION = "0.1.0" as const;

export * from "./process/runner.js";
export * from "./diagnostics/types.js";
export * from "./workspace/policy.js";
export * from "./plugin/types.js";
export * from "./testing/kit.js";
export * from "./creator/index.js";
