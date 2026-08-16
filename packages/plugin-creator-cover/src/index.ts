/**
 * creator-cover plugin (CREATOR-009).
 *
 * Platform-ready cover generation: centralized platform profiles (dimensions
 * with source notes in platforms.ts), deterministic LocalLayoutProvider
 * (overflow / safe-area / font-fallback), mock background generation, and an
 * optional ComfyUI external HTTP/API adapter (GPL-3.0 upstream — adapter only,
 * no source copying; unconfigured -> typed ToolFailure).
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
import { getProfile, PLATFORM_PROFILE_IDS } from "./platforms.js";
import { layoutCover, type LayoutOptions } from "./layout.js";
import { createBackgroundProvider, type CoverProviderKind } from "./providers.js";
import { recordCover, getCover } from "./store.js";

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
    summary: "cover failed",
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
        message: "cover writes require explicit approval (workspace-write)",
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

function resolveProfile(id: unknown): { ok: true; profile: ReturnType<typeof getProfile> & {} } | { ok: false; message: string } {
  if (typeof id !== "string") {
    return { ok: false, message: "profile must be a string platform id" };
  }
  const profile = getProfile(id);
  if (!profile) {
    return {
      ok: false,
      message: `unknown platform profile "${id}"; allowed: ${PLATFORM_PROFILE_IDS.join(", ")}`,
    };
  }
  return { ok: true, profile };
}

const coverGenerateBackground: ToolDefinition = {
  name: "cover_generate_background",
  description:
    "Generate a cover background image (mock, or external ComfyUI HTTP/API adapter when configured; workspace-write).",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      outputPath: { type: "string", description: "workspace-relative output image" },
      width: { type: "number", description: "background width in px (default 1280)" },
      height: { type: "number", description: "background height in px (default 720)" },
      style: { type: "string", description: "background style hint (mock)" },
      provider: {
        type: "string",
        enum: ["mock", "comfyui"],
        description: "mock (default) or ComfyUI external adapter",
      },
    },
    required: ["outputPath"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    const out = resolveWorkspacePath(ctx, String(a.outputPath));
    if (!out.ok) return out.result;
    // Background defaults derive from the youtube-thumbnail profile (no
    // scattered dimension literals).
    const defaultProfile = getProfile("youtube-thumbnail");
    const width =
      typeof a.width === "number" ? Math.floor(a.width) : (defaultProfile?.width ?? 1280);
    const height =
      typeof a.height === "number" ? Math.floor(a.height) : (defaultProfile?.height ?? 720);
    if (width <= 0 || height <= 0) {
      return invalid("width and height must be positive");
    }
    const provider = createBackgroundProvider(
      (a.provider as CoverProviderKind | undefined) ?? "mock",
    );
    const gen = provider.generate(String(a.outputPath), {
      width,
      height,
      style: typeof a.style === "string" ? a.style : undefined,
    });
    if (!gen.ok) return gen.result;
    return success(
      `background ${width}x${height} -> ${gen.result.path}`,
      JSON.stringify(gen.result),
    );
  },
};

const coverLayout: ToolDefinition = {
  name: "cover_layout",
  description:
    "Compute a cover layout for a platform profile (title/subject placement), detecting text overflow, safe-area violations, and font fallback.",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      profile: { type: "string", description: "platform profile id" },
      title: { type: "string", description: "cover title" },
      subject: { type: "string", description: "cover subject/description" },
      font: { type: "string", description: "font name (falls back to Arial)" },
      titleFontSize: { type: "number", description: "title font size in px" },
      subjectFontSize: { type: "number", description: "subject font size in px" },
    },
    required: ["profile"],
  },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const p = resolveProfile(a.profile);
    if (!p.ok) return invalid(p.message);
    const layout = layoutCover(p.profile, a as LayoutOptions);
    if (!layout.ok) return invalid(layout.message);
    return success("cover layout ready", JSON.stringify(layout.result));
  },
};

const coverAddTitle: ToolDefinition = {
  name: "cover_add_title",
  description:
    "Overlay a title on a cover for a platform profile, validating text bounds (overflow / safe area / font fallback); workspace-write.",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      profile: { type: "string", description: "platform profile id" },
      title: { type: "string", description: "cover title" },
      font: { type: "string", description: "font name (falls back to Arial)" },
      titleFontSize: { type: "number", description: "title font size in px" },
      outputPath: { type: "string", description: "workspace-relative output image" },
    },
    required: ["profile", "title", "outputPath"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    const p = resolveProfile(a.profile);
    if (!p.ok) return invalid(p.message);
    const out = resolveWorkspacePath(ctx, String(a.outputPath));
    if (!out.ok) return out.result;
    const layout = layoutCover(p.profile, {
      title: String(a.title),
      font: typeof a.font === "string" ? a.font : undefined,
      titleFontSize: a.titleFontSize as number | undefined,
    });
    if (!layout.ok) return invalid(layout.message);
    recordCover(String(a.outputPath), p.profile.width, p.profile.height);
    return success(
      `title placed on ${p.profile.id} cover`,
      JSON.stringify({ path: a.outputPath, fontFallback: layout.result.fontFallback }),
    );
  },
};

const coverAddSubject: ToolDefinition = {
  name: "cover_add_subject",
  description:
    "Overlay a subject/description on a cover for a platform profile, validating text bounds; workspace-write.",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      profile: { type: "string", description: "platform profile id" },
      subject: { type: "string", description: "cover subject/description" },
      subjectFontSize: { type: "number", description: "subject font size in px" },
      outputPath: { type: "string", description: "workspace-relative output image" },
    },
    required: ["profile", "subject", "outputPath"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    const p = resolveProfile(a.profile);
    if (!p.ok) return invalid(p.message);
    const out = resolveWorkspacePath(ctx, String(a.outputPath));
    if (!out.ok) return out.result;
    const layout = layoutCover(p.profile, {
      subject: String(a.subject),
      subjectFontSize: a.subjectFontSize as number | undefined,
    });
    if (!layout.ok) return invalid(layout.message);
    recordCover(String(a.outputPath), p.profile.width, p.profile.height);
    return success(
      `subject placed on ${p.profile.id} cover`,
      JSON.stringify({ path: a.outputPath }),
    );
  },
};

const coverResize: ToolDefinition = {
  name: "cover_resize",
  description:
    "Resize a cover to a platform profile (or explicit dimensions); workspace-write.",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      inputPath: { type: "string", description: "workspace-relative input image" },
      profile: { type: "string", description: "target platform profile id" },
      width: { type: "number", description: "target width in px (when no profile)" },
      height: { type: "number", description: "target height in px (when no profile)" },
      outputPath: { type: "string", description: "workspace-relative output image" },
    },
    required: ["inputPath", "outputPath"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    const input = resolveWorkspacePath(ctx, String(a.inputPath));
    if (!input.ok) return input.result;
    const out = resolveWorkspacePath(ctx, String(a.outputPath));
    if (!out.ok) return out.result;
    let width: number;
    let height: number;
    if (a.profile !== undefined) {
      const p = resolveProfile(a.profile);
      if (!p.ok) return invalid(p.message);
      width = p.profile.width;
      height = p.profile.height;
    } else if (typeof a.width === "number" && typeof a.height === "number") {
      width = Math.floor(a.width);
      height = Math.floor(a.height);
      if (width <= 0 || height <= 0) return invalid("width and height must be positive");
    } else {
      return invalid("provide a profile or explicit width and height");
    }
    recordCover(String(a.outputPath), width, height);
    return success(
      `resized to ${width}x${height} -> ${a.outputPath}`,
      JSON.stringify({ path: a.outputPath, width, height }),
    );
  },
};

const coverVariants: ToolDefinition = {
  name: "cover_variants",
  description:
    "Generate cover variants for multiple platform profiles (workspace-write) and return their assets.",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      inputPath: { type: "string", description: "workspace-relative input image" },
      profiles: {
        type: "array",
        items: { type: "string" },
        description: "platform profile ids",
      },
      outputDir: { type: "string", description: "workspace-relative output directory" },
    },
    required: ["inputPath", "profiles", "outputDir"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    const input = resolveWorkspacePath(ctx, String(a.inputPath));
    if (!input.ok) return input.result;
    if (!Array.isArray(a.profiles) || a.profiles.length === 0) {
      return invalid("profiles must be a non-empty array of platform ids");
    }
    const dir = resolveWorkspacePath(ctx, String(a.outputDir));
    if (!dir.ok) return dir.result;
    const assets: Array<{ path: string; width: number; height: number; profile: string }> = [];
    for (const id of a.profiles as string[]) {
      const p = resolveProfile(id);
      if (!p.ok) return invalid(`cover_variants: ${p.message}`);
      const rel = `${String(a.outputDir)}/${p.profile.id}.png`;
      recordCover(rel, p.profile.width, p.profile.height);
      assets.push({ path: rel, width: p.profile.width, height: p.profile.height, profile: p.profile.id });
    }
    return success(
      `generated ${assets.length} cover variant(s)`,
      JSON.stringify(assets),
    );
  },
};

const coverValidate: ToolDefinition = {
  name: "cover_validate",
  description:
    "Validate a produced cover's dimensions against a platform profile (or explicit dimensions).",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      inputPath: { type: "string", description: "workspace-relative produced cover" },
      profile: { type: "string", description: "platform profile id" },
      width: { type: "number", description: "expected width in px" },
      height: { type: "number", description: "expected height in px" },
    },
    required: ["inputPath"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const input = resolveWorkspacePath(ctx, String(a.inputPath));
    if (!input.ok) return input.result;
    const record = getCover(String(a.inputPath));
    if (!record) {
      return toolFailure(`no cover record for ${a.inputPath}; produce it with cover_variants/cover_resize first`);
    }
    let expectedWidth: number;
    let expectedHeight: number;
    if (a.profile !== undefined) {
      const p = resolveProfile(a.profile);
      if (!p.ok) return invalid(p.message);
      expectedWidth = p.profile.width;
      expectedHeight = p.profile.height;
    } else if (typeof a.width === "number" && typeof a.height === "number") {
      expectedWidth = Math.floor(a.width);
      expectedHeight = Math.floor(a.height);
    } else {
      return invalid("provide a profile or explicit expected width and height");
    }
    const matches = record.width === expectedWidth && record.height === expectedHeight;
    if (!matches) {
      return toolFailure(
        `dimension mismatch: ${a.inputPath} is ${record.width}x${record.height}, expected ${expectedWidth}x${expectedHeight}`,
      );
    }
    return success(
      `cover valid: ${record.width}x${record.height}`,
      JSON.stringify({ path: a.inputPath, width: record.width, height: record.height, matches: true }),
    );
  },
};

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
    coverGenerateBackground,
    coverLayout,
    coverAddTitle,
    coverAddSubject,
    coverResize,
    coverVariants,
    coverValidate,
  ],
};

export default coverPlugin;
