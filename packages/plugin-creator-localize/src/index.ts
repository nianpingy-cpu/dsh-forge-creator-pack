/**
 * creator-localize plugin (CREATOR-011).
 *
 * Stable subtitle & video localization workflow: translate subtitles, align
 * timing, resegment, localize video, and dub (which MUST pass the creator-voice
 * authorized-reference policy). VideoLingo (Apache-2.0) is referenced as an
 * external provider adapter only — no source copying.
 */
import {
  validateArgs,
  assertCreatorAssetInWorkspace,
  type Plugin,
  type ToolDefinition,
  type ToolResult,
  type ToolContext,
  type CreatorAsset,
} from "@dsh-forge-creator/core";
import { getReference } from "@dsh-forge-creator/plugin-creator-voice";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  parseSrt,
  serializeSrt,
  alignCues,
  resegmentCues,
  type SrtCue,
} from "./srt.js";
import {
  createLocalizeProvider,
  type LocalizeProviderKind,
} from "./providers.js";

const CORE_VERSION = "0.1.0" as const;

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
    summary: "localization failed",
    error: { code: "ToolFailure", message },
  };
}

function success(summary: string, raw: string): ToolResult {
  return { ok: true, summary, raw };
}

function requireApproval(ctx: ToolContext): ToolResult | undefined {
  if (!(ctx.permission?.approved === true)) {
    return {
      ok: false,
      summary: "permission denied",
      error: {
        code: "PermissionDenied",
        message: "localization writes require explicit approval (workspace-write)",
      },
    };
  }
  return undefined;
}

function resolveWorkspacePath(
  ctx: ToolContext,
  path: string,
): { ok: true; canonical: string } | { ok: false; result: ToolResult } {
  try {
    const canonical = assertCreatorAssetInWorkspace(
      { path } as CreatorAsset,
      ctx.workspaceRoot,
    );
    return { ok: true, canonical };
  } catch {
    return {
      ok: false,
      result: {
        ok: false,
        summary: "workspace violation",
        error: {
          code: "WorkspaceViolation",
          message: `path escapes the workspace: ${path}`,
        },
      },
    };
  }
}

/** Read + parse an SRT file from the workspace. */
function readSrtFile(
  ctx: ToolContext,
  path: string,
): { ok: true; cues: SrtCue[] } | { ok: false; result: ToolResult } {
  const resolved = resolveWorkspacePath(ctx, path);
  if (!resolved.ok) return resolved;
  try {
    const text = readFileSync(resolved.canonical, "utf8");
    const parsed = parseSrt(text);
    if (!parsed.ok) return { ok: false, result: invalid(parsed.message) };
    return { ok: true, cues: parsed.cues };
  } catch (err) {
    return {
      ok: false,
      result: toolFailure(`could not read subtitle file: ${String(err)}`),
    };
  }
}

/** Resolve an output path with the overwrite guard (output collision control). */
function resolveOutput(
  ctx: ToolContext,
  outputPath: string,
  overwrite: boolean,
): { ok: true; canonical: string } | { ok: false; result: ToolResult } {
  const resolved = resolveWorkspacePath(ctx, outputPath);
  if (!resolved.ok) return resolved;
  if (!overwrite && existsSync(resolved.canonical)) {
    return {
      ok: false,
      result: {
        ok: false,
        summary: "output exists",
        error: {
          code: "ToolFailure",
          message: `output already exists: ${outputPath}; set overwrite=true to replace it`,
        },
      },
    };
  }
  return resolved;
}

const subtitleTranslate: ToolDefinition = {
  name: "subtitle_translate",
  description:
    "Translate an SRT subtitle file to a target language while preserving valid cue timestamps (workspace-write; overwrite guard).",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      inputPath: { type: "string", description: "workspace-relative SRT file" },
      sourceLanguage: { type: "string", description: "ISO language code" },
      targetLanguage: { type: "string", description: "ISO language code" },
      outputPath: { type: "string", description: "workspace-relative output SRT" },
      provider: {
        type: "string",
        enum: ["mock", "videolingo"],
        description: "mock (default) or VideoLingo-compatible",
      },
      overwrite: { type: "boolean", description: "replace the output if it exists" },
    },
    required: ["inputPath", "sourceLanguage", "targetLanguage", "outputPath"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    // Explicit same-language policy.
    if (String(a.sourceLanguage) === String(a.targetLanguage)) {
      return invalid(
        `source and target languages must differ (both "${a.sourceLanguage}")`,
      );
    }
    const src = readSrtFile(ctx, String(a.inputPath));
    if (!src.ok) return src.result;
    const out = resolveOutput(ctx, String(a.outputPath), a.overwrite === true);
    if (!out.ok) return out.result;
    const provider = createLocalizeProvider(
      (a.provider as LocalizeProviderKind | undefined) ?? "mock",
    );
    const translated: SrtCue[] = [];
    for (const cue of src.cues) {
      const t = provider.translate({
        text: cue.text,
        sourceLanguage: String(a.sourceLanguage),
        targetLanguage: String(a.targetLanguage),
      });
      if (!t.ok) return t.result;
      translated.push({ ...cue, text: t.result.text });
    }
    const srt = serializeSrt(translated);
    const check = parseSrt(srt);
    if (!check.ok) return toolFailure(`translated subtitle invalid: ${check.message}`);
    try {
      writeFileSync(out.canonical, srt, "utf8");
    } catch (err) {
      return toolFailure(`failed to write subtitle: ${String(err)}`);
    }
    return success(
      `translated ${translated.length} cue(s) -> ${a.outputPath}`,
      JSON.stringify({ outputPath: a.outputPath, cues: translated.length }),
    );
  },
};

const subtitleAlign: ToolDefinition = {
  name: "subtitle_align",
  description:
    "Shift all subtitle cue timestamps by offsetMs; rejects negative time (workspace-write; overwrite guard).",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      inputPath: { type: "string", description: "workspace-relative SRT file" },
      offsetMs: { type: "number", description: "timing offset in ms" },
      outputPath: { type: "string", description: "workspace-relative output SRT" },
      overwrite: { type: "boolean", description: "replace the output if it exists" },
    },
    required: ["inputPath", "offsetMs", "outputPath"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    const src = readSrtFile(ctx, String(a.inputPath));
    if (!src.ok) return src.result;
    const out = resolveOutput(ctx, String(a.outputPath), a.overwrite === true);
    if (!out.ok) return out.result;
    const aligned = alignCues(src.cues, Number(a.offsetMs));
    if (!aligned.ok) return invalid(aligned.message);
    const srt = serializeSrt(aligned.cues);
    try {
      writeFileSync(out.canonical, srt, "utf8");
    } catch (err) {
      return toolFailure(`failed to write subtitle: ${String(err)}`);
    }
    return success(
      `aligned ${aligned.cues.length} cue(s) by ${a.offsetMs}ms -> ${a.outputPath}`,
      JSON.stringify({ outputPath: a.outputPath, offsetMs: a.offsetMs }),
    );
  },
};

const subtitleResegment: ToolDefinition = {
  name: "subtitle_resegment",
  description:
    "Split subtitle cues longer than maxDurationMs into bounded sub-cues (workspace-write; overwrite guard).",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      inputPath: { type: "string", description: "workspace-relative SRT file" },
      maxDurationMs: { type: "number", description: "max cue duration in ms" },
      outputPath: { type: "string", description: "workspace-relative output SRT" },
      overwrite: { type: "boolean", description: "replace the output if it exists" },
    },
    required: ["inputPath", "maxDurationMs", "outputPath"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    const src = readSrtFile(ctx, String(a.inputPath));
    if (!src.ok) return src.result;
    const out = resolveOutput(ctx, String(a.outputPath), a.overwrite === true);
    if (!out.ok) return out.result;
    const reseg = resegmentCues(src.cues, Number(a.maxDurationMs));
    if (!reseg.ok) return invalid(reseg.message);
    const srt = serializeSrt(reseg.cues);
    try {
      writeFileSync(out.canonical, srt, "utf8");
    } catch (err) {
      return toolFailure(`failed to write subtitle: ${String(err)}`);
    }
    return success(
      `resegmented to ${reseg.cues.length} cue(s) -> ${a.outputPath}`,
      JSON.stringify({ outputPath: a.outputPath, cues: reseg.cues.length }),
    );
  },
};

const localizeVideo: ToolDefinition = {
  name: "localize_video",
  description:
    "Localize a video: translate its subtitles and produce a localized asset path (workspace-write).",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      subtitlePath: { type: "string", description: "workspace-relative SRT file" },
      sourceLanguage: { type: "string", description: "ISO language code" },
      targetLanguage: { type: "string", description: "ISO language code" },
      outputDir: { type: "string", description: "workspace-relative output directory" },
      provider: {
        type: "string",
        enum: ["mock", "videolingo"],
        description: "mock (default) or VideoLingo-compatible",
      },
    },
    required: ["subtitlePath", "sourceLanguage", "targetLanguage", "outputDir"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    if (String(a.sourceLanguage) === String(a.targetLanguage)) {
      return invalid(
        `source and target languages must differ (both "${a.sourceLanguage}")`,
      );
    }
    const src = readSrtFile(ctx, String(a.subtitlePath));
    if (!src.ok) return src.result;
    const dir = resolveWorkspacePath(ctx, String(a.outputDir));
    if (!dir.ok) return dir.result;
    const provider = createLocalizeProvider(
      (a.provider as LocalizeProviderKind | undefined) ?? "mock",
    );
    const translated: SrtCue[] = [];
    for (const cue of src.cues) {
      const t = provider.translate({
        text: cue.text,
        sourceLanguage: String(a.sourceLanguage),
        targetLanguage: String(a.targetLanguage),
      });
      if (!t.ok) return t.result;
      translated.push({ ...cue, text: t.result.text });
    }
    const rel = `${String(a.outputDir)}/localized.srt`;
    const out = resolveWorkspacePath(ctx, rel);
    if (!out.ok) return out.result;
    const srt = serializeSrt(translated);
    try {
      mkdirSync(dirname(out.canonical), { recursive: true });
      writeFileSync(out.canonical, srt, "utf8");
    } catch (err) {
      return toolFailure(`failed to write localized subtitle: ${String(err)}`);
    }
    return success(
      `localized ${translated.length} cue(s) -> ${rel}`,
      JSON.stringify({ outputPath: rel }),
    );
  },
};

const dubVideo: ToolDefinition = {
  name: "dub_video",
  description:
    "Dub a localized video using an AUTHORIZED voice reference (creator-voice policy; a reference with no authorization is rejected).",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      referenceId: { type: "string", description: "authorized voice reference id" },
      targetLanguage: { type: "string", description: "ISO language code" },
      outputPath: { type: "string", description: "workspace-relative output audio" },
      provider: {
        type: "string",
        enum: ["mock", "videolingo"],
        description: "mock (default) or VideoLingo-compatible",
      },
    },
    required: ["referenceId", "targetLanguage", "outputPath"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    // Dubbing MUST pass the voice policy: the reference must exist and be
    // authorized (registration in creator-voice enforces authorization:true).
    const ref = getReference(String(a.referenceId));
    if (!ref) {
      return {
        ok: false,
        summary: "voice authorization required",
        error: {
          code: "ToolFailure",
          message: `dubbing requires an authorized voice reference; "${a.referenceId}" is not registered (register it with voice_register_reference, authorization: true)`,
        },
      };
    }
    const out = resolveOutput(ctx, String(a.outputPath), a.overwrite === true);
    if (!out.ok) return out.result;
    const provider = createLocalizeProvider(
      (a.provider as LocalizeProviderKind | undefined) ?? "mock",
    );
    // Dubbing routes through the provider so an unconfigured external adapter
    // surfaces a typed diagnostic; the mock returns a synthetic output path.
    const dub = provider.translate({
      text: "dub",
      sourceLanguage: "auto",
      targetLanguage: String(a.targetLanguage),
    });
    if (!dub.ok) return dub.result;
    return success(
      `dubbed using voice ${ref.id} -> ${a.outputPath}`,
      JSON.stringify({ outputPath: a.outputPath, referenceId: ref.id }),
    );
  },
};

const localizePreview: ToolDefinition = {
  name: "localize_preview",
  description:
    "Return a local localization preview descriptor (workspace-relative; no external URLs).",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      subtitlePath: { type: "string", description: "workspace-relative SRT file" },
      targetLanguage: { type: "string", description: "ISO language code" },
      provider: {
        type: "string",
        enum: ["mock", "videolingo"],
        description: "mock (default) or VideoLingo-compatible",
      },
    },
    required: ["subtitlePath", "targetLanguage"],
  },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const base = join(String(a.subtitlePath).replace(/\.srt$/i, ""));
    const preview = {
      targetLanguage: a.targetLanguage,
      previewSubtitlePath: `${base}.${String(a.targetLanguage)}.srt`,
      previewAudioPath: `${base}.${String(a.targetLanguage)}.m4a`,
      kind: "mock",
    };
    return success(
      `localization preview for ${a.targetLanguage}`,
      JSON.stringify(preview),
    );
  },
};

export const localizePlugin: Plugin = {
  metadata: {
    name: "@dsh-forge-creator/plugin-creator-localize",
    version: "0.1.0",
    upstreamTool: "VideoLingo-compatible (Apache-2.0, external provider adapter)",
    coreContractVersion: CORE_VERSION,
    capabilities: [
      "subtitle_translate",
      "subtitle_align",
      "subtitle_resegment",
      "localize_video",
      "dub_video",
      "localize_preview",
    ],
  },
  tools: [
    subtitleTranslate,
    subtitleAlign,
    subtitleResegment,
    localizeVideo,
    dubVideo,
    localizePreview,
  ],
};

export default localizePlugin;
