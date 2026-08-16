/**
 * creator-transcribe plugin (CREATOR-006).
 *
 * Creator-grade transcription: timed segments, SRT/VTT/ASS subtitles,
 * chapter detection, language detection, word granularity, transcript export.
 * Whisper-compatible provider (external binary, MIT) + a deterministic mock
 * for CI. Timestamps are always validated (monotonic, end >= start), empty
 * audio is a typed error, over-long media hits the resource guard, and
 * subtitle outputs are workspace-bound.
 *
 *   transcribe_media      (read)            segments -> Transcript
 *   transcribe_segments   (read)            timed segments
 *   transcribe_words      (read)            word-level segments
 *   subtitle_srt          (workspace-write) SRT file
 *   subtitle_vtt          (workspace-write) WebVTT file
 *   subtitle_ass          (workspace-write) ASS file
 *   chapter_detect        (read)            chapters
 *   language_detect       (read)            language code
 *   transcript_export     (workspace-write) plain-text export
 *
 * (RED — segment/subtitle/providers are stubs; tools return ToolFailure
 * until GREEN implements them.)
 */
import {
  validateArgs,
  type Plugin,
  type ToolDefinition,
  type ToolResult,
  type ToolContext,
  type ExecutionResult,
  type CreatorAsset,
  type InputSchema,
  assertCreatorAssetInWorkspace,
} from "@dsh-forge-creator/core";
import {
  existsSync,
  writeFileSync,
  readFileSync,
  statSync,
  openSync,
  readSync,
  closeSync,
} from "node:fs";
import { createTranscribeProvider } from "./providers.js";
import {
  normalizeSegments,
  detectChapters,
  detectLanguage,
} from "./segments.js";
import { toSrt, toVtt, toAss } from "./subtitle.js";
import { parseWavDuration } from "./wav.js";
import { resolveWhisperBinary, WHISPER_BINARY_HINT } from "./binary.js";
import type {
  Transcript,
  TranscriptSegment,
  TranscribeProviderKind,
  SubtitleFormat,
} from "./types.js";

const CORE_VERSION = "0.1.0" as const;

/** Centralized duration guard (overridable per call). */
const MAX_TRANSCRIBE_DURATION_SECONDS = 1800;

interface FlowArgs {
  audio: string;
  provider?: TranscribeProviderKind;
  language?: string;
  maxDurationSeconds?: number;
}

function invalid(message: string): ToolResult {
  return {
    ok: false,
    summary: "invalid arguments",
    error: { code: "InvalidArguments", message },
  };
}

function toolFailure(message: string): ToolResult {
  return {
    ok: false,
    summary: "transcription failed",
    error: { code: "ToolFailure", message },
  };
}

function success(summary: string, payload: unknown): ToolResult {
  return { ok: true, summary, raw: JSON.stringify(payload) };
}

function validate(
  schema: ToolDefinition["inputSchema"],
  args: unknown,
): ToolResult | null {
  const outcome = validateArgs(schema, args);
  if (!outcome.ok) return invalid(outcome.error);
  return null;
}

type ToolErrorCode = NonNullable<ToolResult["error"]>["code"];

/** Map a CreatorError code to the ToolError code union. */
function mapToolErrorCode(code: string): ToolErrorCode {
  switch (code) {
    case "CREATOR_OUTPUT_OUTSIDE_WORKSPACE":
      return "WorkspaceViolation";
    case "CREATOR_APPROVAL_REQUIRED":
    case "CREATOR_APPROVAL_EXPIRED":
      return "PermissionDenied";
    case "CREATOR_RIGHTS_REQUIRED":
    case "CREATOR_CREDENTIAL_LEAK":
    case "CREATOR_RESOURCE_LIMIT_EXCEEDED":
    case "CREATOR_UNSUPPORTED_CAPABILITY":
    case "CREATOR_VOICE_AUTHORIZATION_REQUIRED":
    default:
      return "ToolFailure";
  }
}

function errorCodeOf(err: unknown, fallback: ToolErrorCode): ToolErrorCode {
  const code = (err as { code?: unknown })?.code;
  return typeof code === "string" ? mapToolErrorCode(code) : fallback;
}

function errorMessageOf(err: unknown, fallback: string): string {
  const message = (err as { message?: unknown })?.message;
  return typeof message === "string" ? message : fallback;
}

/** Canonicalize the audio path and apply emptiness + duration guards. */
function guardAudio(
  audioPath: string,
  workspaceRoot: string,
  maxDurationSeconds?: number,
): { ok: true; canonical: string } | { ok: false; result: ToolResult } {
  let canonical: string;
  try {
    canonical = assertCreatorAssetInWorkspace(
      { path: audioPath } as CreatorAsset,
      workspaceRoot,
    );
  } catch (err) {
    return {
      ok: false,
      result: {
        ok: false,
        summary: "workspace violation",
        error: {
          code: errorCodeOf(err, "ToolFailure"),
          message: errorMessageOf(err, "audio path escapes workspace"),
        },
      },
    };
  }
  if (existsSync(canonical)) {
    const stat = statSync(canonical);
    if (stat.size === 0) {
      return {
        ok: false,
        result: invalid("audio file is empty"),
      };
    }
    // Read only the WAV header (44 bytes) to derive duration instead of
    // loading a potentially large media file into memory.
    const duration = readWavHeaderDuration(canonical);
    const cap = maxDurationSeconds ?? MAX_TRANSCRIBE_DURATION_SECONDS;
    if (duration !== undefined && duration > cap) {
      return {
        ok: false,
        result: {
          ok: false,
          summary: "resource limit exceeded",
          error: {
            code: "ToolFailure",
            message: `audio duration ${duration.toFixed(1)}s exceeds the ${cap}s limit`,
          },
        },
      };
    }
  }
  return { ok: true, canonical };
}

/**
 * Read only the 44-byte WAV header from disk to derive duration, avoiding a
 * full-file read for potentially large media (resource guard).
 */
function readWavHeaderDuration(path: string): number | undefined {
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const header = Buffer.alloc(44);
    const bytes = readSync(fd, header, 0, 44, 0);
    return parseWavDuration(header.subarray(0, bytes));
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** Shared transcription flow. */
async function transcribeFlow(
  ctx: ToolContext,
  args: {
    audio: string;
    provider?: TranscribeProviderKind;
    language?: string;
    maxDurationSeconds?: number;
  },
): Promise<ToolResult> {
  const provider = (args.provider ?? "mock") as TranscribeProviderKind;
  const guarded = guardAudio(args.audio, ctx.workspaceRoot, args.maxDurationSeconds);
  if (!guarded.ok) return guarded.result;
  let transcript: Transcript;
  if (provider === "whisper") {
    // External whisper binary via the core runner (typed argv).
    let exec: ExecutionResult;
    try {
      exec = await ctx.run({
        binary: resolveWhisperBinary(),
        args: [guarded.canonical, "--output_format", "json"],
        cwd: ctx.workspaceRoot,
        timeoutMs: 600_000,
        maxOutputBytes: 20 * 1024 * 1024,
        redact: [args.audio, guarded.canonical],
      });
    } catch (err) {
      return toolFailure(`whisper runner threw: ${String(err)}`);
    }
    if (exec.error?.code === "BinaryNotFound") {
      return {
        ok: false,
        summary: "whisper binary not found",
        error: { code: "BinaryNotFound", message: WHISPER_BINARY_HINT },
      };
    }
    if (exec.timedOut || exec.aborted) {
      return {
        ok: false,
        summary: "whisper timed out",
        error: { code: "Timeout", message: "whisper exceeded the 600s timeout" },
      };
    }
    if (exec.exitCode !== 0) {
      return toolFailure(
        `whisper exited with code ${exec.exitCode}: ${exec.stderr.trim().slice(0, 500)}`,
      );
    }
    let parsed: { segments?: { start: number; end: number; text: string }[] };
    try {
      parsed = JSON.parse(exec.stdout) as typeof parsed;
    } catch {
      // openai-whisper prints human-readable text to stdout and writes the
      // structured JSON to a sidecar file next to the input; fall back to
      // that file when stdout is not JSON. openai-whisper names it
      // `<basename-without-ext>.json` (in cwd / --output_dir); some
      // whisper-compatible CLIs keep the full `<audio>.json` name, so try
      // both.
      const audioStem = guarded.canonical.replace(/\.[^/.]+$/, "");
      const candidates = [`${guarded.canonical}.json`, `${audioStem}.json`];
      try {
        parsed = JSON.parse(
          readFileSync(candidates.find((p) => existsSync(p)) ?? candidates[0]!, "utf8"),
        ) as typeof parsed;
      } catch {
        return toolFailure("whisper returned malformed JSON output");
      }
    }
    const segs = Array.isArray(parsed?.segments) ? parsed.segments : [];
    const raw = segs.map((s, i) => ({
      id: i,
      startMs: Math.round(s.start * 1000),
      endMs: Math.round(s.end * 1000),
      text: s.text.trim(),
    }));
    const normalized = normalizeSegments(raw);
    if (!normalized.ok) {
      return invalid(`whisper produced invalid timestamps: ${normalized.errors.join("; ")}`);
    }
    transcript = {
      segments: normalized.segments,
      language: detectLanguage(raw.map((s) => s.text).join(" ")),
      source: guarded.canonical,
      provider: "whisper",
    };
  } else {
    const providerInstance = createTranscribeProvider("mock");
    transcript = await providerInstance.transcribe({
      audioPath: guarded.canonical,
      language: args.language,
    });
    const normalized = normalizeSegments(transcript.segments);
    if (!normalized.ok) {
      return invalid(`mock transcript has invalid timestamps: ${normalized.errors.join("; ")}`);
    }
    transcript.segments = normalized.segments;
  }
  return success(
    `transcribed ${transcript.segments.length} segment(s) from ${args.audio}`,
    transcript,
  );
}

type PropertySpec = NonNullable<InputSchema["properties"][string]>;

const audioProps: Record<string, PropertySpec> = {
  audio: { type: "string", description: "audio file path inside the workspace" },
  provider: {
    type: "string",
    enum: ["mock", "whisper"],
    description: "transcription provider (default mock)",
  },
  language: { type: "string", description: "optional language hint" },
  maxDurationSeconds: {
    type: "number",
    description: "override the duration guard (default 1800s)",
  },
};

const transcribeMedia: ToolDefinition = {
  name: "transcribe_media",
  description:
    "Transcribe an audio file into a structured Transcript (timed segments + language).",
  mutationClass: "read",
  inputSchema: { type: "object", properties: audioProps, required: ["audio"] },
  async execute(args, ctx) {
    const bad = validate(transcribeMedia.inputSchema, args);
    if (bad) return bad;
    return transcribeFlow(ctx, args as FlowArgs);
  },
};

const transcribeSegments: ToolDefinition = {
  name: "transcribe_segments",
  description: "Return the timed transcript segments of an audio file.",
  mutationClass: "read",
  inputSchema: { type: "object", properties: audioProps, required: ["audio"] },
  async execute(args, ctx) {
    const bad = validate(transcribeSegments.inputSchema, args);
    if (bad) return bad;
    const res = await transcribeFlow(ctx, args as FlowArgs);
    if (!res.ok) return res;
    const transcript = JSON.parse(res.raw!) as Transcript;
    return success(
      `${transcript.segments.length} segment(s)`,
      transcript.segments,
    );
  },
};

const transcribeWords: ToolDefinition = {
  name: "transcribe_words",
  description:
    "Return word-level timed segments (the mock splits each segment into words).",
  mutationClass: "read",
  inputSchema: { type: "object", properties: audioProps, required: ["audio"] },
  async execute(args, ctx) {
    const bad = validate(transcribeWords.inputSchema, args);
    if (bad) return bad;
    const res = await transcribeFlow(ctx, args as FlowArgs);
    if (!res.ok) return res;
    const transcript = JSON.parse(res.raw!) as Transcript;
    const words: TranscriptSegment[] = [];
    for (const seg of transcript.segments) {
      const tokens = seg.text.split(/\s+/).filter(Boolean);
      const span = seg.endMs - seg.startMs;
      tokens.forEach((token, i) => {
        const startMs = seg.startMs + Math.round((span * i) / Math.max(tokens.length, 1));
        const endMs =
          seg.startMs + Math.round((span * (i + 1)) / Math.max(tokens.length, 1));
        words.push({ id: words.length, startMs, endMs, text: token });
      });
    }
    return success(`${words.length} word(s)`, words);
  },
};

/** Factory for the three subtitle-write tools. */
function makeSubtitleTool(
  format: SubtitleFormat,
  name: string,
  description: string,
): ToolDefinition {
  const renderer = { srt: toSrt, vtt: toVtt, ass: toAss }[format];
  return {
    name,
    description,
    mutationClass: "workspace-write",
    inputSchema: {
      type: "object",
      properties: {
        ...audioProps,
        outputPath: { type: "string", description: "workspace output path" },
      },
      required: ["audio", "outputPath"],
    },
    async execute(args, ctx) {
      const bad = validate(makeSubtitleTool(format, name, description).inputSchema, args);
      if (bad) return bad;
      const a = args as Record<string, unknown>;
      const res = await transcribeFlow(ctx, {
        audio: String(a.audio),
        provider: a.provider as TranscribeProviderKind | undefined,
        maxDurationSeconds: a.maxDurationSeconds as number | undefined,
      });
      if (!res.ok) return res;
      const transcript = JSON.parse(res.raw!) as Transcript;
      let canonical: string;
      try {
        canonical = assertCreatorAssetInWorkspace(
          { path: String(a.outputPath) } as CreatorAsset,
          ctx.workspaceRoot,
        );
      } catch (err) {
        return {
          ok: false,
          summary: "workspace violation",
          error: {
            code: errorCodeOf(err, "ToolFailure"),
            message: errorMessageOf(err, "output path escapes workspace"),
          },
        };
      }
      if (!(ctx.permission?.approved === true)) {
        return {
          ok: false,
          summary: "permission denied",
          error: {
            code: "PermissionDenied",
            message: "subtitle writes require approval (workspace-write)",
          },
        };
      }
      try {
        writeFileSync(canonical, renderer(transcript.segments), "utf8");
      } catch (err) {
        return toolFailure(`failed to write subtitle: ${String(err)}`);
      }
      return success(`wrote ${format.toUpperCase()} subtitle to ${canonical}`, {
        outputPath: canonical,
        format,
        segments: transcript.segments.length,
      });
    },
  };
}

const chapterDetect: ToolDefinition = {
  name: "chapter_detect",
  description: "Detect chapters from the transcript segments (gap-based).",
  mutationClass: "read",
  inputSchema: { type: "object", properties: audioProps, required: ["audio"] },
  async execute(args, ctx) {
    const bad = validate(chapterDetect.inputSchema, args);
    if (bad) return bad;
    const res = await transcribeFlow(ctx, args as FlowArgs);
    if (!res.ok) return res;
    const transcript = JSON.parse(res.raw!) as Transcript;
    return success("chapters detected", detectChapters(transcript.segments));
  },
};

const languageDetect: ToolDefinition = {
  name: "language_detect",
  description: "Detect the dominant language of a transcript.",
  mutationClass: "read",
  inputSchema: { type: "object", properties: audioProps, required: ["audio"] },
  async execute(args, ctx) {
    const bad = validate(languageDetect.inputSchema, args);
    if (bad) return bad;
    const res = await transcribeFlow(ctx, args as FlowArgs);
    if (!res.ok) return res;
    const transcript = JSON.parse(res.raw!) as Transcript;
    const text = transcript.segments.map((s) => s.text).join(" ");
    return success(`language: ${detectLanguage(text)}`, {
      language: detectLanguage(text),
    });
  },
};

const transcriptExport: ToolDefinition = {
  name: "transcript_export",
  description:
    "Export a plain-text transcript (with optional timestamps) into the workspace.",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      ...audioProps,
      outputPath: { type: "string", description: "workspace output path" },
      withTimestamps: {
        type: "boolean",
        description: "prefix lines with [mm:ss]",
      },
    },
    required: ["audio", "outputPath"],
  },
  async execute(args, ctx) {
    const bad = validate(transcriptExport.inputSchema, args);
    if (bad) return bad;
    const a = args as Record<string, unknown>;
    const res = await transcribeFlow(ctx, {
      audio: String(a.audio),
      provider: a.provider as TranscribeProviderKind | undefined,
      maxDurationSeconds: a.maxDurationSeconds as number | undefined,
    });
    if (!res.ok) return res;
    const transcript = JSON.parse(res.raw!) as Transcript;
    let canonical: string;
    try {
      canonical = assertCreatorAssetInWorkspace(
        { path: String(a.outputPath) } as CreatorAsset,
        ctx.workspaceRoot,
      );
    } catch (err) {
      return {
        ok: false,
        summary: "workspace violation",
        error: {
          code: errorCodeOf(err, "ToolFailure"),
          message: errorMessageOf(err, "output path escapes workspace"),
        },
      };
    }
    if (!(ctx.permission?.approved === true)) {
      return {
        ok: false,
        summary: "permission denied",
        error: {
          code: "PermissionDenied",
          message: "transcript export requires approval (workspace-write)",
        },
      };
    }
    const withTimestamps = a.withTimestamps === true;
    const lines = transcript.segments.map((s) => {
      const mm = Math.floor(s.startMs / 60_000);
      const ss = Math.floor((s.startMs % 60_000) / 1000);
      return withTimestamps ? `[${mm}:${String(ss).padStart(2, "0")}] ${s.text}` : s.text;
    });
    try {
      writeFileSync(canonical, lines.join("\n") + "\n", "utf8");
    } catch (err) {
      return toolFailure(`failed to write transcript: ${String(err)}`);
    }
    return success(`wrote transcript to ${canonical}`, { outputPath: canonical });
  },
};

export const transcribePlugin: Plugin = {
  metadata: {
    name: "@dsh-forge-creator/plugin-creator-transcribe",
    version: "0.1.0",
    upstreamTool: "Whisper (MIT, external model/binary provider)",
    coreContractVersion: CORE_VERSION,
    capabilities: [
      "transcribe_media",
      "transcribe_segments",
      "transcribe_words",
      "subtitle_srt",
      "subtitle_vtt",
      "subtitle_ass",
      "chapter_detect",
      "language_detect",
      "transcript_export",
    ],
  },
  tools: [
    transcribeMedia,
    transcribeSegments,
    transcribeWords,
    makeSubtitleTool("srt", "subtitle_srt", "Write an SRT subtitle file for an audio file."),
    makeSubtitleTool("vtt", "subtitle_vtt", "Write a WebVTT subtitle file for an audio file."),
    makeSubtitleTool("ass", "subtitle_ass", "Write an ASS subtitle file for an audio file."),
    chapterDetect,
    languageDetect,
    transcriptExport,
  ],
};
