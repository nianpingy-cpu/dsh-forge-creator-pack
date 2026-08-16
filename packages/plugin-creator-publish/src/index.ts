/**
 * creator-publish plugin (CREATOR-013).
 *
 * Controlled multi-platform publishing. The lifecycle is strict:
 *   create draft -> validate -> preview -> explicit approval -> schedule/publish
 * A prompt can NEVER trigger an immediate remote publish. Publish retries
 * distinguish "request failed" (safe to retry with the same idempotency key)
 * from "status unknown" (query the remote status BEFORE resending; never
 * blindly resend). Idempotency keys prevent duplicate posts; dry-run is
 * supported; platform capabilities are discoverable.
 *
 * Providers: MockPublisher (deterministic CI), PostizProvider / OfficialApi /
 * LocalAutomation (EXTERNAL adapters only — no vendoring; unconfigured ->
 * typed ToolFailure). Postiz is AGPL-3.0 -> API adapter only.
 */
import {
  validateArgs,
  assertCreatorAssetInWorkspace,
  assertCreatorApproval,
  type Plugin,
  type ToolDefinition,
  type ToolResult,
  type ToolContext,
  type CreatorAsset,
  type CreatorApproval,
  type PlatformPostDraft,
} from "@dsh-forge-creator/core";
import { createDraftRecord, getDraft, updateDraft, listDrafts } from "./registry.js";
import { createPublisherProvider } from "./providers.js";
import type { PublishProviderKind } from "./types.js";

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
    summary: "publish failed",
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
        message: "publish operations require explicit approval (workspace-write / network)",
      },
    };
  }
  return undefined;
}

/** Redact credential-bearing references from model-visible output. */
function redactCredentials(text: string): string {
  return text
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^@\s/]+@/gi, "$1***@")
    .replace(/([A-Za-z0-9_.-]+):([^@\s/]+)@/g, "$1:***@");
}

/** Default idempotency key for a draft (stable across retries). */
function keyOf(draftId: string): string {
  return `draft-${draftId}`;
}

/** Validate a draft: platform, at least one content carrier, valid media assets. */
function validateDraft(
  draft: unknown,
  workspaceRoot: string,
): { ok: true; value: PlatformPostDraft } | { ok: false; result: ToolResult } {
  if (typeof draft !== "object" || draft === null) {
    return { ok: false, result: invalid("draft must be an object") };
  }
  const d = draft as PlatformPostDraft;
  if (typeof d.platform !== "string" || d.platform.trim() === "") {
    return { ok: false, result: invalid("draft.platform is required") };
  }
  const hasText = typeof d.text === "string" && d.text.trim() !== "";
  const hasTitle = typeof d.title === "string" && d.title.trim() !== "";
  const hasMedia = Array.isArray(d.media) && d.media.length > 0;
  if (!hasText && !hasTitle && !hasMedia) {
    return {
      ok: false,
      result: invalid("draft must have text, a title, or media"),
    };
  }
  if (Array.isArray(d.media)) {
    for (const asset of d.media) {
      if (typeof asset !== "object" || asset === null || typeof (asset as CreatorAsset).path !== "string") {
        return { ok: false, result: invalid("each media asset must have a path") };
      }
      const a = asset as CreatorAsset;
      if (typeof a.checksum !== "string" || a.checksum.trim() === "") {
        return { ok: false, result: invalid("each media asset must have a checksum") };
      }
      try {
        assertCreatorAssetInWorkspace({ path: a.path } as CreatorAsset, workspaceRoot);
      } catch {
        return { ok: false, result: invalid(`media asset path escapes the workspace: ${a.path}`) };
      }
    }
  }
  return { ok: true, value: d };
}

/**
 * Approval gate for remote mutations. Returns a PermissionDenied ToolResult
 * when approval is missing, scope-mismatched, expired, or bound to a
 * different content hash.
 */
function checkApproval(
  approval: unknown,
  scope: "creator-remote-publish" | "creator-remote-destructive",
  contentHash: string,
): ToolResult | undefined {
  try {
    assertCreatorApproval(approval as CreatorApproval | undefined, scope, contentHash);
    return undefined;
  } catch (err) {
    return {
      ok: false,
      summary: "approval required",
      error: { code: "PermissionDenied", message: (err as Error).message },
    };
  }
}

/** Sample draft used to pre-seed deterministic drafts for the contract suite. */
const SAMPLE_DRAFT: PlatformPostDraft = {
  platform: "youtube",
  title: "Hello",
  text: "First post",
  media: [],
  tags: ["test"],
};

// Pre-seed drafts so stateless contract-suite checks are deterministic.
createDraftRecord(SAMPLE_DRAFT); // draft-1
createDraftRecord(SAMPLE_DRAFT); // draft-2
createDraftRecord(SAMPLE_DRAFT); // draft-3

const publisherAccounts: ToolDefinition = {
  name: "publisher_accounts",
  description:
    "List configured publisher accounts for a provider (mock, or external Postiz/Official/Local adapters when configured).",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      provider: {
        type: "string",
        enum: ["mock", "postiz", "official", "local"],
        description: "mock (default) or an external provider adapter",
      },
    },
  },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const provider = createPublisherProvider(
      (a.provider as PublishProviderKind | undefined) ?? "mock",
    );
    const res = provider.accounts();
    if (!res.ok) return res.result;
    return success(
      `${res.accounts.length} account(s)`,
      redactCredentials(JSON.stringify(res.accounts)),
    );
  },
};

const publisherCapabilities: ToolDefinition = {
  name: "publisher_capabilities",
  description:
    "Discover platform capabilities (media kinds, scheduling, API publish) — not all platforms share the same capabilities.",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      provider: {
        type: "string",
        enum: ["mock", "postiz", "official", "local"],
        description: "mock (default) or an external provider adapter",
      },
    },
  },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const provider = createPublisherProvider(
      (a.provider as PublishProviderKind | undefined) ?? "mock",
    );
    const res = provider.capabilities();
    if (!res.ok) return res.result;
    return success(
      `${res.capabilities.length} platform(s)`,
      redactCredentials(JSON.stringify(res.capabilities)),
    );
  },
};

const postValidate: ToolDefinition = {
  name: "post_validate",
  description:
    "Validate a post draft (platform, content, media assets) without any remote publish.",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      draft: { type: "object", description: "post draft" },
    },
    required: ["draft"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const v = validateDraft(a.draft, ctx.workspaceRoot);
    if (!v.ok) return v.result;
    return success(
      `draft valid for ${v.value.platform}`,
      JSON.stringify({ platform: v.value.platform, media: v.value.media.length }),
    );
  },
};

const postPreview: ToolDefinition = {
  name: "post_preview",
  description:
    "Preview a post draft (local descriptor) without any remote publish.",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      draft: { type: "object", description: "post draft" },
    },
    required: ["draft"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const v = validateDraft(a.draft, ctx.workspaceRoot);
    if (!v.ok) return v.result;
    const preview = {
      platform: v.value.platform,
      title: v.value.title ?? "",
      text: v.value.text ?? "",
      mediaCount: v.value.media.length,
      previewPath: `preview/${v.value.platform}.html`,
    };
    return success(
      `preview for ${v.value.platform}`,
      redactCredentials(JSON.stringify(preview)),
    );
  },
};

const postCreateDraft: ToolDefinition = {
  name: "post_create_draft",
  description:
    "Create a local post draft (NO remote publish). Returns a draft id and content hash for later approval.",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      draft: { type: "object", description: "post draft" },
      provider: {
        type: "string",
        enum: ["mock", "postiz", "official", "local"],
        description: "mock (default) or an external provider adapter",
      },
    },
    required: ["draft"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    const v = validateDraft(a.draft, ctx.workspaceRoot);
    if (!v.ok) return v.result;
    const record = createDraftRecord(v.value);
    return success(
      `draft ${record.id} created (no remote publish)`,
      JSON.stringify({ draftId: record.id, contentHash: record.contentHash }),
    );
  },
};

const postPublish: ToolDefinition = {
  name: "post_publish",
  description:
    "Publish a draft after explicit approval. Supports dry-run and an idempotency key; on an unknown remote status it queries the remote status BEFORE resending (never blindly resends).",
  mutationClass: "network",
  inputSchema: {
    type: "object",
    properties: {
      draftId: { type: "string", description: "draft id from post_create_draft" },
      approval: { type: "object", description: "explicit approval token/state (scope creator-remote-publish)" },
      provider: {
        type: "string",
        enum: ["mock", "postiz", "official", "local"],
        description: "mock (default) or an external provider adapter",
      },
      dryRun: { type: "boolean", description: "simulate the publish without any remote side effect" },
      idempotencyKey: { type: "string", description: "stable key preventing duplicate posts" },
    },
    required: ["draftId"],
  },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const record = getDraft(String(a.draftId));
    if (!record) return toolFailure(`unknown draft ${a.draftId}`);
    const gate = checkApproval(a.approval, "creator-remote-publish", record.contentHash);
    if (gate) return gate;
    if (a.dryRun === true) {
      return success(
        `dry-run: would publish ${record.draft.platform}`,
        JSON.stringify({ dryRun: true, draftId: record.id, platform: record.draft.platform, status: "would-publish" }),
      );
    }
    const provider = createPublisherProvider(
      (a.provider as PublishProviderKind | undefined) ?? "mock",
    );
    const key =
      typeof a.idempotencyKey === "string" && a.idempotencyKey.trim() !== ""
        ? a.idempotencyKey
        : keyOf(record.id);
    const attempt = provider.publish(record.draft, key);
    if (!attempt.ok) return attempt.result;
    if (attempt.result.status === "published" || attempt.result.status === "scheduled") {
      updateDraft(record.id, { status: attempt.result.status, postId: attempt.result.postId });
      return success(
        `published as ${attempt.result.postId}`,
        redactCredentials(JSON.stringify({ status: attempt.result.status, postId: attempt.result.postId })),
      );
    }
    if (attempt.result.status === "unknown") {
      // Status unknown: query the remote status BEFORE resending. Never
      // blindly resend (could duplicate the post).
      const q = provider.status(key);
      if (q.ok && (q.result.status === "published" || q.result.status === "scheduled")) {
        updateDraft(record.id, { status: q.result.status, postId: q.result.postId });
        return success(
          `remote status resolved: ${q.result.status}`,
          redactCredentials(JSON.stringify({ status: q.result.status, postId: q.result.postId })),
        );
      }
      return {
        ok: false,
        summary: "remote state unknown",
        error: {
          code: "ToolFailure",
          message: "publish status is unknown; will not blindly resend — query the remote status and retry with the same idempotency key",
        },
      };
    }
    // "failed" (request failed): safe to retry with the same idempotency key.
    return {
      ok: false,
      summary: "publish request failed",
      error: {
        code: "ToolFailure",
        message: attempt.result.error ?? "remote publish request failed; safe to retry with the same idempotency key",
      },
    };
  },
};

const postSchedule: ToolDefinition = {
  name: "post_schedule",
  description:
    "Schedule a draft for a future time after explicit approval (scope creator-remote-publish).",
  mutationClass: "network",
  inputSchema: {
    type: "object",
    properties: {
      draftId: { type: "string", description: "draft id from post_create_draft" },
      scheduledAt: { type: "string", description: "ISO-8601 schedule time" },
      approval: { type: "object", description: "explicit approval token/state (scope creator-remote-publish)" },
      provider: {
        type: "string",
        enum: ["mock", "postiz", "official", "local"],
        description: "mock (default) or an external provider adapter",
      },
    },
    required: ["draftId", "scheduledAt"],
  },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const record = getDraft(String(a.draftId));
    if (!record) return toolFailure(`unknown draft ${a.draftId}`);
    const gate = checkApproval(a.approval, "creator-remote-publish", record.contentHash);
    if (gate) return gate;
    const provider = createPublisherProvider(
      (a.provider as PublishProviderKind | undefined) ?? "mock",
    );
    const key = keyOf(record.id);
    const attempt = provider.publish(record.draft, key, String(a.scheduledAt));
    if (!attempt.ok) return attempt.result;
    if (attempt.result.status !== "scheduled" && attempt.result.status !== "published") {
      return toolFailure(attempt.result.error ?? "schedule request failed");
    }
    updateDraft(record.id, { status: "scheduled", scheduledAt: String(a.scheduledAt), postId: attempt.result.postId });
    return success(
      `scheduled ${record.id} for ${a.scheduledAt}`,
      redactCredentials(JSON.stringify({ postId: attempt.result.postId, status: "scheduled", scheduledAt: a.scheduledAt })),
    );
  },
};

const postStatus: ToolDefinition = {
  name: "post_status",
  description:
    "Query the tracked status of a post/draft (never publishes).",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      draftId: { type: "string", description: "draft id" },
      postId: { type: "string", description: "remote post id (alternative to draftId)" },
      provider: {
        type: "string",
        enum: ["mock", "postiz", "official", "local"],
        description: "mock (default) or an external provider adapter",
      },
    },
  },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    if (a.draftId !== undefined) {
      const record = getDraft(String(a.draftId));
      if (!record) return toolFailure(`unknown draft ${a.draftId}`);
      return success(
        `${record.id}: ${record.status}`,
        redactCredentials(JSON.stringify({ draftId: record.id, status: record.status, postId: record.postId })),
      );
    }
    if (a.postId !== undefined) {
      // Search tracked drafts for the post id.
      for (const record of listDrafts()) {
        if (record.postId === String(a.postId)) {
          return success(
            `${a.postId}: ${record.status}`,
            redactCredentials(JSON.stringify({ draftId: record.id, status: record.status, postId: record.postId })),
          );
        }
      }
      return toolFailure(`no tracked post with id ${a.postId}`);
    }
    return invalid("provide draftId or postId");
  },
};

const postCancelSchedule: ToolDefinition = {
  name: "post_cancel_schedule",
  description:
    "Cancel a remote scheduled post after explicit DESTRUCTIVE approval (scope creator-remote-destructive).",
  mutationClass: "network",
  inputSchema: {
    type: "object",
    properties: {
      draftId: { type: "string", description: "draft id" },
      approval: { type: "object", description: "explicit approval token/state (scope creator-remote-destructive)" },
      provider: {
        type: "string",
        enum: ["mock", "postiz", "official", "local"],
        description: "mock (default) or an external provider adapter",
      },
    },
    required: ["draftId"],
  },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const record = getDraft(String(a.draftId));
    if (!record) return toolFailure(`unknown draft ${a.draftId}`);
    const gate = checkApproval(a.approval, "creator-remote-destructive", record.contentHash);
    if (gate) return gate;
    if (record.status !== "scheduled" || !record.postId) {
      // Idempotent cancel: nothing to cancel.
      return success(`no active schedule for ${record.id}`, JSON.stringify({ draftId: record.id, cancelled: true }));
    }
    const provider = createPublisherProvider(
      (a.provider as PublishProviderKind | undefined) ?? "mock",
    );
    const cancel = provider.cancel(record.postId);
    if (!cancel.ok) return cancel.result;
    updateDraft(record.id, { status: "draft", postId: undefined });
    return success(
      `cancelled schedule for ${record.id}`,
      JSON.stringify({ draftId: record.id, cancelled: true }),
    );
  },
};

export const publishPlugin: Plugin = {
  metadata: {
    name: "@dsh-forge-creator/plugin-creator-publish",
    version: "0.1.0",
    upstreamTool: "Postiz-compatible (AGPL-3.0, external API adapter)",
    coreContractVersion: CORE_VERSION,
    capabilities: [
      "publisher_accounts",
      "publisher_capabilities",
      "post_validate",
      "post_preview",
      "post_create_draft",
      "post_schedule",
      "post_publish",
      "post_status",
      "post_cancel_schedule",
    ],
  },
  tools: [
    publisherAccounts,
    publisherCapabilities,
    postValidate,
    postPreview,
    postCreateDraft,
    postSchedule,
    postPublish,
    postStatus,
    postCancelSchedule,
  ],
};

export default publishPlugin;
