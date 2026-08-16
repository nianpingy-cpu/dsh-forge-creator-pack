/**
 * creator-motion plugin (CREATOR-012).
 *
 * Templated, verifiable programmatic video rendering. Built-in deterministic
 * template fixtures with metadata (id, name, aspectRatios, inputSchema,
 * estimatedDuration, engine); a fully-local mock renderer for CI; and a
 * generic Remotion-compatible HTTP/command provider interface (Remotion's
 * license is custom/NOASSERTION — NO vendoring; unconfigured -> typed
 * ToolFailure). See docs/creator/UPSTREAM_LICENSES.md (Remotion gate).
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
import {
  getTemplate,
  validateTemplateInput,
  MOTION_TEMPLATES,
  type MotionTemplate,
} from "./templates.js";
import {
  createMotionProvider,
  type MotionProviderKind,
  type MotionRenderResult,
} from "./providers.js";

const CORE_VERSION = "0.1.0" as const;

function invalid(message: string): ToolResult {
  return {
    ok: false,
    summary: "invalid arguments",
    error: { code: "InvalidArguments", message },
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
        message: "motion renders require explicit approval (workspace-write)",
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

/** Resolve a template by id -> unknown template fails. */
function resolveTemplate(id: string): { ok: true; template: MotionTemplate } | { ok: false; result: ToolResult } {
  const template = getTemplate(id);
  if (!template) {
    return { ok: false, result: invalid(`unknown template "${id}"`) };
  }
  return { ok: true, template };
}

/** Validate the requested aspect ratio is supported by the template. */
function validateAspect(
  template: MotionTemplate,
  aspectRatio: string,
): { ok: true; aspectRatio: string } | { ok: false; result: ToolResult } {
  if (!template.aspectRatios.includes(aspectRatio)) {
    return {
      ok: false,
      result: invalid(
        `template "${template.id}" does not support aspect ratio "${aspectRatio}"; supported: ${template.aspectRatios.join(", ")}`,
      ),
    };
  }
  return { ok: true, aspectRatio };
}

/** Render-timeout budget check (deterministic mock render duration). */
function checkRenderBudget(
  template: MotionTemplate,
  timeoutMs: number,
): { ok: true } | { ok: false; result: ToolResult } {
  if (timeoutMs < template.estimatedDuration * 1000) {
    return {
      ok: false,
      result: {
        ok: false,
        summary: "render timed out",
        error: {
          code: "Timeout",
          message: `render of template "${template.id}" needs ~${template.estimatedDuration}s but the budget is ${timeoutMs}ms`,
        },
      },
    };
  }
  return { ok: true };
}

const motionTemplates: ToolDefinition = {
  name: "motion_templates",
  description:
    "List available motion templates with their metadata (aspectRatios, inputSchema, estimatedDuration, engine).",
  mutationClass: "read",
  inputSchema: { type: "object", properties: {} },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    return success(
      "motion templates",
      JSON.stringify(MOTION_TEMPLATES),
    );
  },
};

const motionInspectTemplate: ToolDefinition = {
  name: "motion_inspect_template",
  description:
    "Inspect a motion template's full metadata and input schema.",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      template: { type: "string", description: "template id" },
    },
    required: ["template"],
  },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const t = resolveTemplate(String(a.template));
    if (!t.ok) return t.result;
    return success(
      `template ${t.template.id}`,
      JSON.stringify(t.template),
    );
  },
};

const motionRender: ToolDefinition = {
  name: "motion_render",
  description:
    "Render a motion template to an output path with a validated aspect ratio and input (workspace-write; render-timeout budget enforced).",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      template: { type: "string", description: "template id" },
      input: { type: "object", description: "template input (validated against inputSchema)" },
      aspectRatio: { type: "string", description: "aspect ratio (default: first supported)" },
      outputPath: { type: "string", description: "workspace-relative output video" },
      timeoutMs: { type: "number", description: "render timeout budget in ms (default 120000)" },
      provider: {
        type: "string",
        enum: ["mock", "remotion"],
        description: "mock (default) or Remotion-compatible external renderer",
      },
    },
    required: ["template", "outputPath"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    const t = resolveTemplate(String(a.template));
    if (!t.ok) return t.result;
    const input = validateTemplateInput(t.template, (a.input as Record<string, unknown>) ?? {});
    if (!input.ok) return invalid(input.message);
    const aspectRatio = String(a.aspectRatio ?? t.template.aspectRatios[0]);
    const aspect = validateAspect(t.template, aspectRatio);
    if (!aspect.ok) return aspect.result;
    const timeoutMs =
      typeof a.timeoutMs === "number" && a.timeoutMs > 0 ? Math.floor(a.timeoutMs) : 120_000;
    const budget = checkRenderBudget(t.template, timeoutMs);
    if (!budget.ok) return budget.result;
    const out = resolveWorkspacePath(ctx, String(a.outputPath));
    if (!out.ok) return out.result;
    const provider = createMotionProvider(
      (a.provider as MotionProviderKind | undefined) ?? "mock",
    );
    const render = provider.render({
      template: t.template,
      aspectRatio: aspect.aspectRatio,
      input: input.value,
      outputPath: String(a.outputPath),
    });
    if (!render.ok) return render.result;
    return success(
      `rendered ${t.template.id} (${aspect.aspectRatio}) -> ${render.result.path}`,
      JSON.stringify(render.result),
    );
  },
};

const motionRenderVariants: ToolDefinition = {
  name: "motion_render_variants",
  description:
    "Render a template at multiple aspect ratios into an output directory, returning per-variant metadata (rejects variant naming collisions).",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      template: { type: "string", description: "template id" },
      input: { type: "object", description: "template input (validated against inputSchema)" },
      outputDir: { type: "string", description: "workspace-relative output directory" },
      aspectRatios: {
        type: "array",
        items: { type: "string" },
        description: "aspect ratios to render (default: all supported by the template)",
      },
      provider: {
        type: "string",
        enum: ["mock", "remotion"],
        description: "mock (default) or Remotion-compatible external renderer",
      },
    },
    required: ["template", "outputDir"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    const t = resolveTemplate(String(a.template));
    if (!t.ok) return t.result;
    const input = validateTemplateInput(t.template, (a.input as Record<string, unknown>) ?? {});
    if (!input.ok) return invalid(input.message);
    const requested =
      Array.isArray(a.aspectRatios) && a.aspectRatios.length > 0
        ? (a.aspectRatios as string[])
        : [...t.template.aspectRatios];
    // Variant naming collision: duplicate aspect ratios would map to the same
    // output filename.
    const seen = new Set<string>();
    for (const ratio of requested) {
      if (seen.has(ratio)) {
        return invalid(`variant naming collision: duplicate aspect ratio "${ratio}"`);
      }
      seen.add(ratio);
    }
    const dir = resolveWorkspacePath(ctx, String(a.outputDir));
    if (!dir.ok) return dir.result;
    const provider = createMotionProvider(
      (a.provider as MotionProviderKind | undefined) ?? "mock",
    );
    const assets: MotionRenderResult[] = [];
    for (const ratio of requested) {
      const aspect = validateAspect(t.template, ratio);
      if (!aspect.ok) return aspect.result;
      const rel = `${String(a.outputDir)}/${t.template.id}-${ratio.replace(":", "x")}.mp4`;
      const render = provider.render({
        template: t.template,
        aspectRatio: aspect.aspectRatio,
        input: input.value,
        outputPath: rel,
      });
      if (!render.ok) return render.result;
      assets.push(render.result);
    }
    return success(
      `rendered ${assets.length} variant(s) of ${t.template.id}`,
      JSON.stringify(assets),
    );
  },
};

const motionPreview: ToolDefinition = {
  name: "motion_preview",
  description:
    "Return a local preview descriptor for a motion template (workspace-relative; no external URLs).",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      template: { type: "string", description: "template id" },
      input: { type: "object", description: "template input (validated against inputSchema)" },
      aspectRatio: { type: "string", description: "aspect ratio (default: first supported)" },
    },
    required: ["template"],
  },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const t = resolveTemplate(String(a.template));
    if (!t.ok) return t.result;
    const input = validateTemplateInput(t.template, (a.input as Record<string, unknown>) ?? {});
    if (!input.ok) return invalid(input.message);
    const aspectRatio = String(a.aspectRatio ?? t.template.aspectRatios[0]);
    const aspect = validateAspect(t.template, aspectRatio);
    if (!aspect.ok) return aspect.result;
    const preview = {
      templateId: t.template.id,
      aspectRatio: aspect.aspectRatio,
      previewPath: `preview/${t.template.id}-${aspect.aspectRatio.replace(":", "x")}.mp4`,
      estimatedDuration: t.template.estimatedDuration,
      engine: t.template.engine,
    };
    return success(`preview for ${t.template.id}`, JSON.stringify(preview));
  },
};

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
    motionTemplates,
    motionInspectTemplate,
    motionRender,
    motionRenderVariants,
    motionPreview,
  ],
};

export default motionPlugin;
