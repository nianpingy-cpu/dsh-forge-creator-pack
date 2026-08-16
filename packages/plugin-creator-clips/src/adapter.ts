/**
 * creator-clips -> ffmpeg adapter orchestration (CREATOR-007).
 *
 * creator-clips NEVER builds ffmpeg/ffprobe argv itself. It composes the
 * carried-in `@dsh-forge-creator/plugin-ffmpeg` adapter (REUSE) by invoking
 * its high-level tool definitions with the same ToolContext, so the adapter's
 * hardening (workspace boundary, overwrite guard, protocol whitelist, playlist
 * rejection, no shell, permission gate) applies unchanged.
 */
import {
  ffmpegPlugin,
  type ToolDefinition,
} from "@dsh-forge-creator/plugin-ffmpeg";
import type { ToolContext, ToolResult } from "@dsh-forge-creator/core";

function adapterTool(name: string): ToolDefinition {
  const tool = ffmpegPlugin.tools.find((t) => t.name === name);
  if (!tool) throw new Error(`ffmpeg adapter tool missing: ${name}`);
  return tool;
}

/** Invoke a carried-in ffmpeg adapter tool with the caller's context. */
export async function callAdapter(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  return adapterTool(name).execute(args as never, ctx);
}

/** Probe a media file's duration in seconds via the adapter's media_probe. */
export async function probeDuration(
  ctx: ToolContext,
  input: string,
): Promise<{ ok: true; seconds: number | undefined } | { ok: false; result: ToolResult }> {
  const probe = await callAdapter("media_probe", { input }, ctx);
  if (!probe.ok) {
    return { ok: false, result: probe };
  }
  let parsed: { format?: { duration?: string | number } } | null = null;
  try {
    parsed = JSON.parse(probe.raw ?? "") as typeof parsed;
  } catch {
    parsed = null;
  }
  const dur = parsed?.format?.duration;
  const seconds =
    typeof dur === "number" ? dur : typeof dur === "string" ? Number(dur) : NaN;
  return {
    ok: true,
    seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : undefined,
  };
}
