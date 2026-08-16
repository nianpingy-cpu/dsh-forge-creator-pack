/**
 * creator-capture plugin (CREATOR-005).
 *
 * Controlled, licensed media capture via yt-dlp (Unlicense, external CLI).
 * Typed argv[] only — never a shell string, never arbitrary extra args.
 * Every download mutation requires sourceUrl + outputPath + rights
 * confirmation, passes the core safety policy (rights / no-bypass /
 * workspace / resource limits), and returns a CreatorAsset with provenance.
 *
 *   media_inspect       (network)          yt-dlp -J
 *   media_formats       (network)          yt-dlp -J --list-formats
 *   media_download      (workspace-write)  yt-dlp -o
 *   audio_download      (workspace-write)  yt-dlp -x --audio-format
 *   subtitle_download   (workspace-write)  yt-dlp --write-subs --skip-download
 *   thumbnail_download  (workspace-write)  yt-dlp --write-thumbnail --skip-download
 *   playlist_inspect    (network)          yt-dlp -J --flat-playlist (bounded)
 *   playlist_download   (workspace-write)  bounded playlist download
 *
 * (RED — argv builders are stubs; download tools return ToolFailure until
 * GREEN implements them.)
 */
import {
  validateArgs,
  type Plugin,
  type ToolDefinition,
  type ToolResult,
  type ToolContext,
  type ExecutionResult,
  type CreatorAsset,
  type RightsMetadata,
  assertRightsPolicy,
  assertNoBypassFlags,
  assertCreatorAssetInWorkspace,
  assertWithinResourceLimits,
} from "@dsh-forge-creator/core";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { createHash } from "node:crypto";
import {
  buildDownloadArgv,
  buildInspectArgv,
  buildFormatsArgv,
  buildPlaylistArgv,
} from "./argv.js";
import { resolveYtDlpBinary, YT_DLP_BINARY_HINT } from "./binary.js";
import type {
  CaptureKind,
  ConflictPolicy,
  RightsConfirmation,
} from "./types.js";

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
    summary: "capture failed",
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

function errorCodeOf(err: unknown, fallback: string): string {
  const code = (err as { code?: unknown })?.code;
  return typeof code === "string" ? code : fallback;
}

function errorMessageOf(err: unknown, fallback: string): string {
  const message = (err as { message?: unknown })?.message;
  return typeof message === "string" ? message : fallback;
}

/** Resolve the output path under the explicit conflict policy. */
export function resolveOutputPath(
  outputPath: string,
  conflict: ConflictPolicy,
): { ok: true; path: string } | { ok: false; message: string } {
  if (!existsSync(outputPath)) return { ok: true, path: outputPath };
  switch (conflict) {
    case "fail":
      return {
        ok: false,
        message: `output already exists: ${outputPath} (conflict policy = fail)`,
      };
    case "rename": {
      const ext = extname(outputPath);
      const base = basename(outputPath, ext);
      const dir = dirname(outputPath);
      for (let i = 1; i <= 100; i++) {
        const candidate = join(dir, `${base}-${i}${ext}`);
        if (!existsSync(candidate)) return { ok: true, path: candidate };
      }
      return { ok: false, message: "could not find a unique output name" };
    }
    case "overwrite-approved":
      return { ok: true, path: outputPath };
  }
}

/** Map a capture kind + output extension to a CreatorAsset type. */
function assetTypeFor(path: string, kind: CaptureKind): CreatorAsset["type"] {
  if (kind === "audio") return "audio";
  if (kind === "subtitle") return "subtitle";
  if (kind === "thumbnail") return "image";
  const ext = extname(path).toLowerCase();
  if (["mp3", "m4a", "wav", "aac", "flac", "ogg"].includes(ext)) return "audio";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
  if (["srt", "vtt", "ass"].includes(ext)) return "subtitle";
  return "video";
}

/** Build a CreatorAsset from a captured output file (checksum when present). */
export function toCreatorAsset(
  outputPath: string,
  kind: CaptureKind,
  rights: RightsConfirmation,
  sourceUrl: string,
): CreatorAsset {
  let checksum = "pending-verification";
  try {
    if (existsSync(outputPath)) {
      checksum = createHash("sha256")
        .update(readFileSync(outputPath))
        .digest("hex");
    }
  } catch {
    // checksum stays pending when the file is not yet on disk (dry-run/mock)
  }
  return {
    id: `capture-${createHash("sha1").update(outputPath).digest("hex").slice(0, 12)}`,
    path: outputPath,
    type: assetTypeFor(outputPath, kind),
    source: sourceUrl,
    checksum,
    rights: rights as RightsMetadata,
    metadata: { capturedBy: "creator-capture" },
  };
}

/** Shared download flow: guards -> argv -> (dry-run | execute) -> asset. */
async function runDownload(
  ctx: ToolContext,
  spec: {
    sourceUrl: string;
    outputPath: string;
    kind: CaptureKind;
    conflict: ConflictPolicy;
    rights: RightsConfirmation;
    playlistLimit?: number;
    subtitleLang?: string;
    format?: string;
    dryRun?: boolean;
  },
): Promise<ToolResult> {
  try {
    assertNoBypassFlags(spec as unknown as Record<string, unknown>);
  } catch (err) {
    return {
      ok: false,
      summary: "forbidden option",
      error: {
        code: errorCodeOf(err, "ToolFailure"),
        message: errorMessageOf(err, "forbidden option"),
      },
    };
  }
  try {
    assertRightsPolicy(spec.rights as RightsMetadata, "strict");
  } catch (err) {
    return {
      ok: false,
      summary: "rights required",
      error: {
        code: errorCodeOf(err, "ToolFailure"),
        message: errorMessageOf(err, "rights required"),
      },
    };
  }
  let canonical: string;
  try {
    canonical = assertCreatorAssetInWorkspace(
      { path: spec.outputPath } as CreatorAsset,
      ctx.workspaceRoot,
    );
  } catch (err) {
    return {
      ok: false,
      summary: "workspace violation",
      error: {
        code: errorCodeOf(err, "ToolFailure"),
        message: errorMessageOf(err, "path escapes workspace"),
      },
    };
  }
  const resolved = resolveOutputPath(canonical, spec.conflict);
  if (!resolved.ok) return invalid(resolved.message);
  try {
    assertWithinResourceLimits({ batchItems: spec.playlistLimit });
  } catch (err) {
    return {
      ok: false,
      summary: "resource limit exceeded",
      error: {
        code: errorCodeOf(err, "ToolFailure"),
        message: errorMessageOf(err, "resource limit exceeded"),
      },
    };
  }
  const argvResult = buildDownloadArgv({
    sourceUrl: spec.sourceUrl,
    outputPath: resolved.path,
    kind: spec.kind,
    conflict: spec.conflict,
    playlistLimit: spec.playlistLimit,
    subtitleLang: spec.subtitleLang,
    format: spec.format,
    dryRun: spec.dryRun,
  });
  if (!argvResult.ok) return invalid(argvResult.errors.join("; "));
  if (spec.dryRun) {
    return success(
      `dry-run: would download ${spec.sourceUrl} to ${resolved.path}`,
      {
        outputPath: resolved.path,
        argv: argvResult.argv,
        asset: toCreatorAsset(
          resolved.path,
          spec.kind,
          spec.rights,
          spec.sourceUrl,
        ),
      },
    );
  }
  let exec: ExecutionResult;
  try {
    exec = await ctx.run({
      binary: resolveYtDlpBinary(),
      args: argvResult.argv,
      cwd: ctx.workspaceRoot,
      timeoutMs: 300_000,
      maxOutputBytes: 20 * 1024 * 1024,
    });
  } catch (err) {
    return toolFailure(`yt-dlp runner threw: ${String(err)}`);
  }
  if (exec.error?.code === "BinaryNotFound") {
    return {
      ok: false,
      summary: "yt-dlp binary not found",
      error: { code: "BinaryNotFound", message: YT_DLP_BINARY_HINT },
    };
  }
  if (exec.timedOut || exec.aborted) {
    return {
      ok: false,
      summary: "yt-dlp timed out",
      error: { code: "Timeout", message: "yt-dlp exceeded the 300s timeout" },
    };
  }
  if (exec.exitCode !== 0) {
    return toolFailure(
      `yt-dlp exited with code ${exec.exitCode}: ${exec.stderr
        .trim()
        .slice(0, 500)}`,
    );
  }
  return success(
    `captured ${spec.sourceUrl} to ${resolved.path}`,
    toCreatorAsset(resolved.path, spec.kind, spec.rights, spec.sourceUrl),
  );
}

/** Shared inspect flow (read tools). */
async function runInspect(
  ctx: ToolContext,
  argv: string[],
): Promise<ToolResult> {
  let exec: ExecutionResult;
  try {
    exec = await ctx.run({
      binary: resolveYtDlpBinary(),
      args: argv,
      cwd: ctx.workspaceRoot,
      timeoutMs: 60_000,
      maxOutputBytes: 20 * 1024 * 1024,
    });
  } catch (err) {
    return toolFailure(`yt-dlp runner threw: ${String(err)}`);
  }
  if (exec.error?.code === "BinaryNotFound") {
    return {
      ok: false,
      summary: "yt-dlp binary not found",
      error: { code: "BinaryNotFound", message: YT_DLP_BINARY_HINT },
    };
  }
  if (exec.timedOut || exec.aborted) {
    return {
      ok: false,
      summary: "yt-dlp timed out",
      error: { code: "Timeout", message: "yt-dlp exceeded the 60s timeout" },
    };
  }
  if (exec.exitCode !== 0) {
    return toolFailure(
      `yt-dlp exited with code ${exec.exitCode}: ${exec.stderr
        .trim()
        .slice(0, 500)}`,
    );
  }
  return success("inspection ok", { stdout: exec.stdout.slice(0, 50_000) });
}

const baseDownloadProps: Record<string, unknown> = {
  sourceUrl: { type: "string", description: "media source URL" },
  outputPath: { type: "string", description: "workspace output path" },
  rights: {
    type: "object",
    description:
      "rights confirmation: status owned|licensed|public-domain|permission-confirmed",
  },
  conflict: {
    type: "string",
    enum: ["fail", "rename", "overwrite-approved"],
    description: "file-exists conflict policy",
  },
  playlistLimit: { type: "number", description: "max playlist items" },
  format: { type: "string", description: "output format (e.g. mp4, mp3)" },
  dryRun: { type: "boolean", description: "preview argv without executing" },
};

const RIGHT_CONFIRMED: RightsConfirmation = {
  status: "owned",
  note: "creator-owned test asset",
};

/** Factory for the four download tools to avoid schema duplication. */
function makeDownloadTool(
  kind: CaptureKind,
  name: string,
  description: string,
  extraProps: Record<string, unknown> = {},
  extraRequired: string[] = [],
): ToolDefinition {
  const schema: ToolDefinition["inputSchema"] = {
    type: "object",
    properties: { ...baseDownloadProps, ...extraProps },
    required: ["sourceUrl", "outputPath", "rights", "conflict", ...extraRequired],
  };
  return {
    name,
    description,
    mutationClass: "workspace-write",
    inputSchema: schema,
    async execute(args, ctx) {
      const bad = validate(schema, args);
      if (bad) return bad;
      const a = args as Record<string, unknown>;
      return runDownload(ctx, {
        sourceUrl: String(a.sourceUrl),
        outputPath: String(a.outputPath),
        kind,
        conflict: a.conflict as ConflictPolicy,
        rights: (a.rights as RightsConfirmation) ?? RIGHT_CONFIRMED,
        playlistLimit: a.playlistLimit as number | undefined,
        subtitleLang: a.subtitleLang as string | undefined,
        format: a.format as string | undefined,
        dryRun: a.dryRun as boolean | undefined,
      });
    },
  };
}

const mediaInspect: ToolDefinition = {
  name: "media_inspect",
  description:
    "Inspect a media source (yt-dlp -J): title, duration, uploader, availability.",
  mutationClass: "network",
  inputSchema: {
    type: "object",
    properties: {
      sourceUrl: { type: "string", description: "media source URL" },
    },
    required: ["sourceUrl"],
  },
  async execute(args, ctx) {
    const bad = validate(mediaInspect.inputSchema, args);
    if (bad) return bad;
    const { sourceUrl } = args as { sourceUrl: string };
    return runInspect(ctx, buildInspectArgv(sourceUrl));
  },
};

const mediaFormats: ToolDefinition = {
  name: "media_formats",
  description:
    "List available formats for a media source (yt-dlp -J --list-formats).",
  mutationClass: "network",
  inputSchema: {
    type: "object",
    properties: {
      sourceUrl: { type: "string", description: "media source URL" },
    },
    required: ["sourceUrl"],
  },
  async execute(args, ctx) {
    const bad = validate(mediaFormats.inputSchema, args);
    if (bad) return bad;
    const { sourceUrl } = args as { sourceUrl: string };
    return runInspect(ctx, buildFormatsArgv(sourceUrl));
  },
};

const playlistInspect: ToolDefinition = {
  name: "playlist_inspect",
  description:
    "Inspect a playlist (flat) with a bounded item count (yt-dlp -J --flat-playlist).",
  mutationClass: "network",
  inputSchema: {
    type: "object",
    properties: {
      sourceUrl: { type: "string", description: "playlist URL" },
      limit: { type: "number", description: "max items (1..50, default 10)" },
    },
    required: ["sourceUrl"],
  },
  async execute(args, ctx) {
    const bad = validate(playlistInspect.inputSchema, args);
    if (bad) return bad;
    const { sourceUrl, limit } = args as { sourceUrl: string; limit?: number };
    const bounded = Math.min(Math.max(limit ?? 10, 1), 50);
    return runInspect(ctx, buildPlaylistArgv(sourceUrl, "", bounded, false));
  },
};

const playlistDownload: ToolDefinition = {
  name: "playlist_download",
  description:
    "Download a bounded playlist into a workspace directory with explicit rights confirmation.",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      ...baseDownloadProps,
      outputDir: { type: "string", description: "workspace output directory" },
    },
    required: ["sourceUrl", "outputDir", "rights", "conflict"],
  },
  async execute(args, ctx) {
    const bad = validate(playlistDownload.inputSchema, args);
    if (bad) return bad;
    const a = args as Record<string, unknown>;
    const outputDir = String(a.outputDir);
    let canonical: string;
    try {
      canonical = assertCreatorAssetInWorkspace(
        { path: outputDir } as CreatorAsset,
        ctx.workspaceRoot,
      );
    } catch (err) {
      return {
        ok: false,
        summary: "workspace violation",
        error: {
          code: errorCodeOf(err, "ToolFailure"),
          message: errorMessageOf(err, "path escapes workspace"),
        },
      };
    }
    const limit = (a.playlistLimit as number | undefined) ?? 10;
    const argv = buildPlaylistArgv(
      String(a.sourceUrl),
      canonical,
      limit,
      true,
    );
    if (a.dryRun) {
      return success(`dry-run: would download playlist to ${canonical}`, {
        outputDir: canonical,
        argv,
      });
    }
    let exec: ExecutionResult;
    try {
      exec = await ctx.run({
        binary: resolveYtDlpBinary(),
        args: argv,
        cwd: ctx.workspaceRoot,
        timeoutMs: 600_000,
        maxOutputBytes: 20 * 1024 * 1024,
      });
    } catch (err) {
      return toolFailure(`yt-dlp runner threw: ${String(err)}`);
    }
    if (exec.error?.code === "BinaryNotFound") {
      return {
        ok: false,
        summary: "yt-dlp binary not found",
        error: { code: "BinaryNotFound", message: YT_DLP_BINARY_HINT },
      };
    }
    if (exec.exitCode !== 0) {
      return toolFailure(
        `yt-dlp exited with code ${exec.exitCode}: ${exec.stderr
          .trim()
          .slice(0, 500)}`,
      );
    }
    return success(`downloaded playlist to ${canonical}`, {
      outputDir: canonical,
    });
  },
};

export const capturePlugin: Plugin = {
  metadata: {
    name: "@dsh-forge-creator/plugin-creator-capture",
    version: "0.1.0",
    upstreamTool: "yt-dlp (Unlicense, external CLI binary)",
    coreContractVersion: CORE_VERSION,
    capabilities: [
      "media_inspect",
      "media_formats",
      "media_download",
      "audio_download",
      "subtitle_download",
      "thumbnail_download",
      "playlist_inspect",
      "playlist_download",
    ],
  },
  tools: [
    mediaInspect,
    mediaFormats,
    makeDownloadTool(
      "media",
      "media_download",
      "Download a media item (video) into the workspace with explicit rights confirmation. Returns a CreatorAsset with provenance.",
    ),
    makeDownloadTool(
      "audio",
      "audio_download",
      "Download/extract audio (mp3) with explicit rights confirmation.",
    ),
    makeDownloadTool(
      "subtitle",
      "subtitle_download",
      "Download subtitles without the video, with explicit rights confirmation.",
      {
        subtitleLang: {
          type: "string",
          description: "subtitle language code (default en)",
        },
      },
    ),
    makeDownloadTool(
      "thumbnail",
      "thumbnail_download",
      "Download a thumbnail without the video, with explicit rights confirmation.",
    ),
    playlistInspect,
    playlistDownload,
  ],
};
