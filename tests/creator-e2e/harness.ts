/**
 * E2E harness (CREATOR-015) — deterministic end-to-end stories.
 *
 * Loads real plugin tool implementations into a registry, drives them with a
 * shared ToolContext over a fresh temp workspace, and stubs the process
 * runner with canned media outputs (ffprobe -> 10s 1080x1920, ffmpeg ->
 * success, downloaders -> ok) so no binary or external account is required.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  ExecutionResult,
  ExecutionRunner,
  Plugin,
  ToolContext,
  ToolDefinition,
  ToolResult,
} from "@dsh-forge-creator/core";

export const OK: ExecutionResult = {
  exitCode: 0,
  stdout: "",
  stderr: "",
  timedOut: false,
  aborted: false,
  truncated: false,
  durationMs: 1,
};

/** Canned ffprobe: 10s container with a 1080x1920 (9:16) video stream. */
export const PROBE_JSON = JSON.stringify({
  format: { format_name: "mp4", duration: "10.000000", size: "1000" },
  streams: [
    { index: 0, codec_type: "video", codec_name: "h264", width: 1080, height: 1920 },
  ],
});

export const FFMPEG_OUTPUT =
  "frame= 10 fps=0.0 q=-0.0 size=N/A time=00:00:03.00 bitrate=N/A speed= 1x";

/** Canned media runner: ffprobe -> PROBE_JSON, ffmpeg -> success, else ok. */
export function mockMediaRunner(): ExecutionRunner {
  return async (req) => {
    const key = req.binary.toLowerCase();
    if (key.includes("ffprobe")) {
      // Spread OK first so its stdout/exitCode defaults do not clobber these.
      return { ...OK, exitCode: 0, stdout: PROBE_JSON, stderr: "" };
    }
    if (key.includes("ffmpeg")) {
      return { ...OK, exitCode: 0, stdout: FFMPEG_OUTPUT, stderr: "" };
    }
    return { ...OK, stdout: "{}" };
  };
}

export interface E2EContext {
  workspaceRoot: string;
  cleanup: () => void;
  registry: Map<string, ToolDefinition>;
  ctx: (approved?: boolean, runner?: ExecutionRunner) => ToolContext;
  invoke: (
    name: string,
    args: Record<string, unknown>,
    opts?: { approved?: boolean; runner?: ExecutionRunner },
  ) => Promise<ToolResult>;
}

/** Build an E2E harness over the given plugins (registration order kept). */
export function createE2E(plugins: readonly Plugin[]): E2EContext {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "dsh-e2e-"));
  const registry = new Map<string, ToolDefinition>();
  for (const plugin of plugins) {
    for (const tool of plugin.tools) {
      registry.set(tool.name, tool);
    }
  }
  const ctx = (approved = true, runner = mockMediaRunner()): ToolContext => ({
    workspaceRoot,
    run: runner,
    permission: approved ? { approved: true } : undefined,
  });
  const invoke: E2EContext["invoke"] = async (name, args, opts = {}) => {
    const tool = registry.get(name);
    if (!tool) {
      throw new Error(`e2e harness: unknown tool "${name}"`);
    }
    return tool.execute(args as never, ctx(opts.approved ?? true, opts.runner));
  };
  return {
    workspaceRoot,
    cleanup: () => rmSync(workspaceRoot, { recursive: true, force: true }),
    registry,
    ctx,
    invoke,
  };
}

/** Write a fixture file into the harness workspace and return its rel path. */
export function writeFixture(
  root: string,
  rel: string,
  content = "placeholder",
): string {
  writeFileSync(join(root, rel), content, "utf8");
  return rel;
}
