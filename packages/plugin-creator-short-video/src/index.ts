/**
 * creator-short-video plugin (CREATOR-008).
 *
 * Topic/script -> short-video job adapter. Plan -> generate -> status ->
 * assets lifecycle with a deterministic mock provider and a
 * MoneyPrinterTurbo-compatible provider adapter (no vendoring; unconfigured ->
 * typed ToolFailure). The Plan Schema (script, aspectRatio, durationTarget,
 * voiceMode, subtitleMode, assetStrategy, outputDir) is validated centrally in
 * plan.ts; no free-form provider strings reach the tools.
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
import { validatePlan, type PlanInput } from "./plan.js";
import { createShortVideoProvider } from "./providers.js";
import {
  SHORT_VIDEO_STATUS_POLL_LIMIT,
  type ShortVideoProviderKind,
} from "./types.js";

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

/** Redact credential-bearing external references from provider-derived text. */
function redactExternalRefs(text: string): string {
  return text
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^@\s/]+@/gi, "$1***@")
    .replace(/([A-Za-z0-9_.-]+):([^@\s/]+)@/g, "$1:***@");
}

function requireApproval(ctx: ToolContext): ToolResult | undefined {
  if (!(ctx.permission?.approved === true)) {
    return {
      ok: false,
      summary: "permission denied",
      error: {
        code: "PermissionDenied",
        message: "short-video generation writes require explicit approval (workspace-write)",
      },
    };
  }
  return undefined;
}

function resolveOutputDir(
  ctx: ToolContext,
  outputDir: string,
): { ok: true; canonical: string } | { ok: false; result: ToolResult } {
  try {
    const canonical = assertCreatorAssetInWorkspace(
      { path: outputDir } as CreatorAsset,
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
          message: `outputDir escapes the workspace: ${outputDir}`,
        },
      },
    };
  }
}

const shortVideoPlanTool: ToolDefinition = {
  name: "short_video_plan",
  description:
    "Create a validated short-video plan from a topic and/or script with defaults (aspectRatio, durationTarget, voiceMode, subtitleMode, assetStrategy, outputDir).",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      topic: { type: "string", description: "topic used to derive a script when script is absent" },
      script: { type: "string", description: "full script for the short video" },
      aspectRatio: { type: "string", description: "16:9 | 9:16 | 1:1 | 4:5" },
      durationTarget: { type: "number", description: "target duration in seconds (5..600)" },
      voiceMode: { type: "string", description: "default | male | female | narrator" },
      subtitleMode: { type: "string", description: "none | burned | soft" },
      assetStrategy: { type: "string", description: "stock | ai | existing" },
      outputDir: { type: "string", description: "workspace-relative output directory" },
    },
  },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const outcome = validatePlan(args as PlanInput);
    if (!outcome.ok) return invalid(outcome.message);
    return success(
      "short-video plan ready",
      JSON.stringify(outcome.plan),
    );
  },
};

const shortVideoGenerate: ToolDefinition = {
  name: "short_video_generate",
  description:
    "Submit a short-video plan to a provider and create a job (workspace-write). Requires a plan; outputDir must stay inside the workspace. Optionally waits for completion with a bounded poll.",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      plan: { type: "object", description: "validated short-video plan" },
      provider: {
        type: "string",
        enum: ["mock", "mpt"],
        description: "mock (default) or MoneyPrinterTurbo-compatible",
      },
      waitForComplete: { type: "boolean", description: "poll until complete (bounded)" },
      maxPollAttempts: { type: "number", description: "max status polls before timeout" },
    },
    required: ["plan"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    // RED: no plan -> cannot generate.
    if (!a.plan || typeof a.plan !== "object") {
      return invalid("generate requires a plan (call short_video_plan first)");
    }
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const outcome = validatePlan(a.plan as PlanInput);
    if (!outcome.ok) return invalid(outcome.message);
    const dir = resolveOutputDir(ctx, outcome.plan.outputDir);
    if (!dir.ok) return dir.result;
    const provider = createShortVideoProvider(
      (a.provider as ShortVideoProviderKind | undefined) ?? "mock",
    );
    const submitted = provider.submit(outcome.plan);
    if (!submitted.ok) return submitted.result;
    const maxPollAttempts =
      typeof a.maxPollAttempts === "number"
        ? Math.max(1, Math.floor(a.maxPollAttempts))
        : SHORT_VIDEO_STATUS_POLL_LIMIT;
    let job = submitted.job;
    if (a.waitForComplete === true) {
      for (let i = 0; i < maxPollAttempts; i++) {
        const poll = provider.poll(job.id);
        if (!poll.ok) return poll.result;
        job = poll.job;
        if (job.status === "complete" || job.status === "failed") break;
      }
      if (job.status !== "complete") {
        return {
          ok: false,
          summary: "short-video job timed out",
          error: {
            code: "Timeout",
            message: `short-video job ${job.id} did not complete within ${maxPollAttempts} poll(s)`,
          },
        };
      }
    }
    return success("short-video job submitted", JSON.stringify(job));
  },
};

const shortVideoStatus: ToolDefinition = {
  name: "short_video_status",
  description:
    "Poll the status of a short-video job. Enforces a max poll attempt limit (default 10) and returns a typed Timeout when exceeded.",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      jobId: { type: "string", description: "short-video job id" },
      provider: {
        type: "string",
        enum: ["mock", "mpt"],
        description: "mock (default) or MoneyPrinterTurbo-compatible",
      },
      maxPollAttempts: { type: "number", description: "max status polls before timeout" },
    },
    required: ["jobId"],
  },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const provider = createShortVideoProvider(
      (a.provider as ShortVideoProviderKind | undefined) ?? "mock",
    );
    const poll = provider.poll(String(a.jobId));
    if (!poll.ok) return poll.result;
    const maxPollAttempts =
      typeof a.maxPollAttempts === "number"
        ? Math.max(1, Math.floor(a.maxPollAttempts))
        : SHORT_VIDEO_STATUS_POLL_LIMIT;
    if (poll.job.status !== "complete" && poll.job.attempts >= maxPollAttempts) {
      return {
        ok: false,
        summary: "short-video status timed out",
        error: {
          code: "Timeout",
          message: `short-video job ${poll.job.id} exceeded ${maxPollAttempts} poll(s) without completing`,
        },
      };
    }
    return success(
      `short-video job ${poll.job.id}: ${poll.job.status}`,
      JSON.stringify(poll.job),
    );
  },
};

const shortVideoAssets: ToolDefinition = {
  name: "short_video_assets",
  description:
    "List the generated assets of a completed short-video job (workspace-relative paths; never external URLs).",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      jobId: { type: "string", description: "short-video job id" },
      provider: {
        type: "string",
        enum: ["mock", "mpt"],
        description: "mock (default) or MoneyPrinterTurbo-compatible",
      },
    },
    required: ["jobId"],
  },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const provider = createShortVideoProvider(
      (a.provider as ShortVideoProviderKind | undefined) ?? "mock",
    );
    const res = provider.assets(String(a.jobId));
    if (!res.ok) return res.result;
    return success(
      `${res.assets.length} asset(s)`,
      redactExternalRefs(JSON.stringify(res.assets)),
    );
  },
};

const shortVideoPreview: ToolDefinition = {
  name: "short_video_preview",
  description:
    "Return a local preview descriptor for a plan (workspace-relative preview path; no external URLs or credentials).",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      plan: { type: "object", description: "validated short-video plan" },
    },
    required: ["plan"],
  },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const outcome = validatePlan(a.plan as PlanInput);
    if (!outcome.ok) return invalid(outcome.message);
    const plan = outcome.plan;
    const preview = {
      plan,
      previewPath: `${plan.outputDir}/preview.html`,
      aspectRatio: plan.aspectRatio,
      durationTarget: plan.durationTarget,
    };
    return success(
      `preview for ${plan.aspectRatio}`,
      redactExternalRefs(JSON.stringify(preview)),
    );
  },
};

export const shortVideoPlugin: Plugin = {
  metadata: {
    name: "@dsh-forge-creator/plugin-creator-short-video",
    version: "0.1.0",
    upstreamTool: "MoneyPrinterTurbo-compatible (MIT, external provider adapter)",
    coreContractVersion: CORE_VERSION,
    capabilities: [
      "short_video_plan",
      "short_video_generate",
      "short_video_status",
      "short_video_assets",
      "short_video_preview",
    ],
  },
  tools: [
    shortVideoPlanTool,
    shortVideoGenerate,
    shortVideoStatus,
    shortVideoAssets,
    shortVideoPreview,
  ],
};

export default shortVideoPlugin;
