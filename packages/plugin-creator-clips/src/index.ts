/**
 * creator-clips plugin (CREATOR-007).
 *
 * High-level creator-workflow clipping that composes the carried-in ffmpeg
 * adapter (`@dsh-forge-creator/plugin-ffmpeg`, REUSE). This plugin NEVER
 * builds ffmpeg/ffprobe argv and exposes only fixed, typed high-level
 * workflows — no free-form FFmpeg parameter strings reach any tool schema.
 *
 * Tools compose the adapter:
 *   clip_by_time        -> video_clip (range validated + duration-checked)
 *   clip_by_chapter     -> video_clip (chapter range)
 *   clip_by_transcript  -> video_clip (transcript segment range)
 *   remove_silence      -> silence_remove (fixed params)
 *   make_vertical       -> video_vertical (verifies 9:16 output)
 *   make_square         -> video_square (verifies 1:1 output)
 *   batch_clip          -> video_clip loop (collision-checked)
 *   merge_segments      -> video_concat
 */
import {
  validateArgs,
  type Plugin,
  type ToolDefinition,
  type ToolResult,
  type ToolContext,
  type InputSchema,
} from "@dsh-forge-creator/core";
import { callAdapter, probeDuration } from "./adapter.js";
import {
  parseTimestamp,
  validateRange,
  withinDuration,
  detectBatchCollisions,
} from "./validate.js";
import type { TimestampArg } from "./types.js";

const CORE_VERSION = "0.1.0" as const;

function invalid(message: string): ToolResult {
  return {
    ok: false,
    summary: "invalid arguments",
    error: { code: "InvalidArguments", message },
  };
}

function permissionDenied(): ToolResult {
  return {
    ok: false,
    summary: "permission denied",
    error: {
      code: "PermissionDenied",
      message: "clip writes require explicit approval (workspace-write)",
    },
  };
}

function toolFailure(message: string): ToolResult {
  return {
    ok: false,
    summary: "clipping failed",
    error: { code: "ToolFailure", message },
  };
}

function success(summary: string, raw?: string): ToolResult {
  return { ok: true, summary, raw };
}

/** Workspace-write gate, consistent with the other creator plugins. */
function requireApproval(ctx: ToolContext): ToolResult | undefined {
  if (!(ctx.permission?.approved === true)) return permissionDenied();
  return undefined;
}

const tsSchema = {
  type: ["number", "string"] as const,
  description: "seconds (number) or mm:ss (string)",
};

const inputProps: InputSchema["properties"] = {
  input: { type: "string", description: "workspace-relative input media" },
};

const outputProps: InputSchema["properties"] = {
  output: { type: "string", description: "workspace-relative output file" },
  overwrite: { type: "boolean", description: "replace the output if it exists" },
};

/** Shared clip flow: validate range + duration, then delegate to video_clip. */
async function clipFlow(
  ctx: ToolContext,
  args: {
    input: string;
    start: TimestampArg;
    end: TimestampArg;
    output: string;
    overwrite?: boolean;
  },
): Promise<ToolResult> {
  const gate = requireApproval(ctx);
  if (gate) return gate;
  const range = validateRange(args.start, args.end);
  if (!range.ok) return invalid(range.message);
  const probe = await probeDuration(ctx, args.input);
  if (!probe.ok) return probe.result;
  if (probe.seconds !== undefined) {
    const bound = withinDuration(range, probe.seconds);
    if (!bound.ok) return invalid(bound.message);
  }
  return callAdapter(
    "video_clip",
    {
      input: args.input,
      start: String(range.start),
      duration: String(range.duration),
      output: args.output,
      ...(args.overwrite !== undefined ? { overwrite: args.overwrite } : {}),
    },
    ctx,
  );
}

const clipByTime: ToolDefinition = {
  name: "clip_by_time",
  description:
    "Clip a media file by an absolute time range [start, end) (workspace-write; composes the ffmpeg adapter; range and duration validated).",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      ...inputProps,
      start: tsSchema,
      end: tsSchema,
      ...outputProps,
    },
    required: ["input", "start", "end", "output"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    return clipFlow(ctx, {
      input: String(a.input),
      start: a.start as TimestampArg,
      end: a.end as TimestampArg,
      output: String(a.output),
      overwrite: a.overwrite as boolean | undefined,
    });
  },
};

const clipByChapter: ToolDefinition = {
  name: "clip_by_chapter",
  description:
    "Clip a media file to a named chapter's time range (workspace-write; composes the ffmpeg adapter).",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      ...inputProps,
      chapter: {
        type: "object",
        description: "chapter with name (optional), start and end (seconds)",
      },
      ...outputProps,
    },
    required: ["input", "chapter", "output"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const chapter = a.chapter as { start?: TimestampArg; end?: TimestampArg };
    if (typeof chapter !== "object" || chapter === null) {
      return invalid("chapter must be an object with start and end");
    }
    if (
      chapter.start === undefined ||
      chapter.end === undefined ||
      parseTimestamp(chapter.start) === undefined ||
      parseTimestamp(chapter.end) === undefined
    ) {
      return invalid("chapter must have valid start and end seconds");
    }
    return clipFlow(ctx, {
      input: String(a.input),
      start: chapter.start,
      end: chapter.end,
      output: String(a.output),
      overwrite: a.overwrite as boolean | undefined,
    });
  },
};

const clipByTranscript: ToolDefinition = {
  name: "clip_by_transcript",
  description:
    "Clip a media file to a transcript segment's time range (workspace-write; composes the ffmpeg adapter).",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      ...inputProps,
      segment: {
        type: "object",
        description: "transcript segment with start and end (seconds)",
      },
      ...outputProps,
    },
    required: ["input", "segment", "output"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const segment = a.segment as { start?: TimestampArg; end?: TimestampArg };
    if (typeof segment !== "object" || segment === null) {
      return invalid("segment must be an object with start and end");
    }
    if (
      segment.start === undefined ||
      segment.end === undefined ||
      parseTimestamp(segment.start) === undefined ||
      parseTimestamp(segment.end) === undefined
    ) {
      return invalid("segment must have valid start and end seconds");
    }
    return clipFlow(ctx, {
      input: String(a.input),
      start: segment.start,
      end: segment.end,
      output: String(a.output),
      overwrite: a.overwrite as boolean | undefined,
    });
  },
};

/** Simple write-tool builder that delegates to one adapter tool. */
function adapterDelegator(
  name: string,
  adapterToolName: string,
  description: string,
  required: readonly string[],
  extraProps?: InputSchema["properties"],
): ToolDefinition {
  const inputSchema: InputSchema = {
    type: "object",
    properties: {
      ...inputProps,
      ...outputProps,
      ...(extraProps ?? {}),
    },
    required,
  };
  return {
    name,
    description,
    mutationClass: "workspace-write",
    inputSchema,
    async execute(args, ctx) {
      const bad = validateArgs(this.inputSchema, args);
      if (!bad.ok) return invalid(bad.error);
      const gate = requireApproval(ctx);
      if (gate) return gate;
      const a = args as Record<string, unknown>;
      return callAdapter(adapterToolName, { ...a }, ctx);
    },
  };
}

const removeSilence = adapterDelegator(
  "remove_silence",
  "silence_remove",
  "Remove silence from an audio file with fixed parameters (workspace-write; composes the ffmpeg adapter).",
  ["input", "output"],
);

const makeVertical = adapterDelegator(
  "make_vertical",
  "video_vertical",
  "Reformat a video to 9:16 and verify the output aspect ratio via ffprobe (workspace-write; composes the ffmpeg adapter).",
  ["input", "output"],
);

const makeSquare = adapterDelegator(
  "make_square",
  "video_square",
  "Reformat a video to 1:1 and verify the output aspect ratio via ffprobe (workspace-write; composes the ffmpeg adapter).",
  ["input", "output"],
);

const mergeSegments = adapterDelegator(
  "merge_segments",
  "video_concat",
  "Concatenate media segments with the same codecs (workspace-write; composes the ffmpeg adapter).",
  ["inputs", "output"],
  { inputs: { type: "array", items: { type: "string" } } },
);

const batchClip: ToolDefinition = {
  name: "batch_clip",
  description:
    "Clip multiple time ranges in one workflow; rejects output collisions and invalid ranges before any write (workspace-write).",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      clips: {
        type: "array",
        items: { type: "object" },
        description: "array of {input, start, end, output, overwrite?}",
      },
    },
    required: ["clips"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as { clips: unknown };
    if (!Array.isArray(a.clips) || a.clips.length === 0) {
      return invalid("clips must be a non-empty array");
    }
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const items = a.clips as Array<{
      input?: unknown;
      start?: unknown;
      end?: unknown;
      output?: unknown;
      overwrite?: unknown;
    }>;
    // Validate every item before any write.
    for (const c of items) {
      if (
        typeof c.input !== "string" ||
        typeof c.output !== "string" ||
        c.start === undefined ||
        c.end === undefined
      ) {
        return invalid("each clip must have input, start, end and output");
      }
      const range = validateRange(c.start as TimestampArg, c.end as TimestampArg);
      if (!range.ok) return invalid(`clip ${c.output}: ${range.message}`);
    }
    const collision = detectBatchCollisions(items.map((c) => String(c.output)));
    if (!collision.ok) return invalid(collision.message);
    const results: ToolResult[] = [];
    for (const c of items) {
      const r = await clipFlow(ctx, {
        input: String(c.input),
        start: c.start as TimestampArg,
        end: c.end as TimestampArg,
        output: String(c.output),
        overwrite: c.overwrite as boolean | undefined,
      });
      results.push(r);
    }
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      const first = failed[0];
      return toolFailure(
        `batch failed: ${failed.length}/${results.length} clip(s) failed; first error: ${first?.error?.message ?? "unknown"}`,
      );
    }
    return success(`clipped ${results.length} segment(s)`);
  },
};

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
    clipByTime,
    clipByChapter,
    clipByTranscript,
    removeSilence,
    makeVertical,
    makeSquare,
    batchClip,
    mergeSegments,
  ],
};

export default creatorClipsPlugin;
