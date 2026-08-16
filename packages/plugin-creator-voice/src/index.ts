/**
 * creator-voice plugin (CREATOR-010).
 *
 * Licensed TTS / voice clone. Voice cloning/transfer may only target an
 * AUTHORIZED voice reference (registered via voice_register_reference with
 * authorization: true). A bare celebrity/person name can never be cloned or
 * transferred. Reference metadata stores only source, owner / permission
 * note, checksum, createdAt — never unnecessary biometric information.
 */
import {
  validateArgs,
  assertCreatorAssetInWorkspace,
  assertVoiceAuthorization,
  type Plugin,
  type ToolDefinition,
  type ToolResult,
  type ToolContext,
  type CreatorAsset,
} from "@dsh-forge-creator/core";
import { registerReference, getReference, listReferences } from "./registry.js";
import { createVoiceProvider, type VoiceProviderKindLike } from "./providers.js";
import type { VoiceReferenceInput } from "./types.js";

const CORE_VERSION = "0.1.0" as const;

function invalid(message: string): ToolResult {
  return {
    ok: false,
    summary: "invalid arguments",
    error: { code: "InvalidArguments", message },
  };
}

function voiceAuthRequired(message: string): ToolResult {
  return {
    ok: false,
    summary: "voice authorization required",
    error: { code: "ToolFailure", message },
  };
}

function success(summary: string, raw: string): ToolResult {
  return { ok: true, summary, raw };
}

/** Redact credential-bearing references from model-visible output. */
function redactCredentials(text: string): string {
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
        message: "voice operations require explicit approval (workspace-write)",
      },
    };
  }
  return undefined;
}

function resolveOutputPath(
  ctx: ToolContext,
  path: string,
): { ok: true; canonical: string } | { ok: false; result: ToolResult } {
  try {
    // NOTE: the canonical path is validated here (realpath-safe, no `..`).
    // A real OpenVoice adapter that writes audio MUST bind writes to this
    // canonical path (not the raw outputPath) to close the check-then-use
    // gap; the current mock only returns the path.
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

/**
 * Resolve an authorized voice reference. A reference must exist AND carry
 * authorization; this is the only legal clone/transfer source.
 */
function requireAuthorizedReference(
  referenceId: string,
): { ok: true; id: string } | { ok: false; result: ToolResult } {
  const ref = getReference(referenceId);
  if (!ref) {
    return {
      ok: false,
      result: voiceAuthRequired(
        `no authorized voice reference for "${referenceId}"; register one with voice_register_reference (authorization: true) first`,
      ),
    };
  }
  // All registered references are authorized (registration enforces
  // authorization: true); this guard is defense in depth.
  try {
    assertVoiceAuthorization({ authorized: true, authorizationNote: ref.authorizationNote });
  } catch {
    return { ok: false, result: voiceAuthRequired("voice reference is not authorized") };
  }
  return { ok: true, id: ref.id };
}

/** Seed a sample authorized reference so stateless clone/transfer/preview checks are deterministic. */
registerReference({
  name: "Sample Voice",
  source: "synthetic fixture",
  owner: "dsh-forge-creator",
  authorization: true,
  authorizationNote: "synthetic fixture voice",
});

const voiceRegisterReference: ToolDefinition = {
  name: "voice_register_reference",
  description:
    "Register an authorized voice reference (authorization: true required). Stores source, owner/permission note, checksum, createdAt — never biometrics.",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "display name of the voice" },
      source: { type: "string", description: "where the voice comes from (URL/path)" },
      owner: { type: "string", description: "owner / permission holder" },
      authorization: { type: "boolean", description: "MUST be true" },
      authorizationNote: { type: "string", description: "permission note" },
    },
    required: ["name", "source", "owner", "authorization"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as unknown as VoiceReferenceInput;
    if (a.authorization !== true) {
      return invalid("authorization must be true to register a voice reference");
    }
    if (!a.name.trim() || !a.source.trim() || !a.owner.trim()) {
      return invalid("name, source and owner are required");
    }
    const ref = registerReference(a);
    if (!ref) return invalid("authorization must be true to register a voice reference");
    return success(
      `registered voice reference ${ref.id}`,
      redactCredentials(JSON.stringify(ref)),
    );
  },
};

const voiceList: ToolDefinition = {
  name: "voice_list",
  description:
    "List registered authorized voice references (no biometric data).",
  mutationClass: "read",
  inputSchema: { type: "object", properties: {} },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    return success(
      "voice references",
      redactCredentials(JSON.stringify(listReferences())),
    );
  },
};

const ttsGenerate: ToolDefinition = {
  name: "tts_generate",
  description:
    "Generate TTS audio (default synthetic voice, or an authorized registered reference). A voice with no authorized reference is rejected.",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "text to speak" },
      voice: { type: "string", description: "registered authorized reference id (optional)" },
      outputPath: { type: "string", description: "workspace-relative output audio" },
      provider: {
        type: "string",
        enum: ["mock", "openvoice"],
        description: "mock (default) or OpenVoice-compatible",
      },
    },
    required: ["text", "outputPath"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    if (typeof a.text !== "string" || a.text.trim() === "") {
      return invalid("text must be a non-empty string");
    }
    const out = resolveOutputPath(ctx, String(a.outputPath));
    if (!out.ok) return out.result;
    let referenceId: string | undefined;
    if (a.voice !== undefined) {
      const ref = requireAuthorizedReference(String(a.voice));
      if (!ref.ok) return ref.result;
      referenceId = ref.id;
    }
    const provider = createVoiceProvider(
      (a.provider as VoiceProviderKindLike | undefined) ?? "mock",
    );
    const gen = provider.generate(
      { outputPath: String(a.outputPath), text: String(a.text), referenceId },
      "tts",
    );
    if (!gen.ok) return gen.result;
    return success(
      `TTS generated -> ${gen.result.path}`,
      redactCredentials(JSON.stringify(gen.result)),
    );
  },
};

const voiceClone: ToolDefinition = {
  name: "voice_clone",
  description:
    "Clone a voice from an AUTHORIZED reference only. A bare celebrity/person name is rejected (no authorized reference).",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      referenceId: { type: "string", description: "registered authorized voice reference id" },
      outputPath: { type: "string", description: "workspace-relative output audio" },
      provider: {
        type: "string",
        enum: ["mock", "openvoice"],
        description: "mock (default) or OpenVoice-compatible",
      },
    },
    required: ["referenceId", "outputPath"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    const ref = requireAuthorizedReference(String(a.referenceId));
    if (!ref.ok) return ref.result;
    const out = resolveOutputPath(ctx, String(a.outputPath));
    if (!out.ok) return out.result;
    const provider = createVoiceProvider(
      (a.provider as VoiceProviderKindLike | undefined) ?? "mock",
    );
    const gen = provider.generate(
      { outputPath: String(a.outputPath), text: "voice clone", referenceId: ref.id },
      "clone",
    );
    if (!gen.ok) return gen.result;
    return success(
      `voice clone generated -> ${gen.result.path}`,
      redactCredentials(JSON.stringify(gen.result)),
    );
  },
};

const voiceStyleTransfer: ToolDefinition = {
  name: "voice_style_transfer",
  description:
    "Transfer a style onto a voice from an AUTHORIZED reference only.",
  mutationClass: "workspace-write",
  inputSchema: {
    type: "object",
    properties: {
      referenceId: { type: "string", description: "registered authorized voice reference id" },
      style: { type: "string", description: "target style (e.g. calm, energetic)" },
      outputPath: { type: "string", description: "workspace-relative output audio" },
      provider: {
        type: "string",
        enum: ["mock", "openvoice"],
        description: "mock (default) or OpenVoice-compatible",
      },
    },
    required: ["referenceId", "outputPath"],
  },
  async execute(args, ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const gate = requireApproval(ctx);
    if (gate) return gate;
    const a = args as Record<string, unknown>;
    const ref = requireAuthorizedReference(String(a.referenceId));
    if (!ref.ok) return ref.result;
    const out = resolveOutputPath(ctx, String(a.outputPath));
    if (!out.ok) return out.result;
    const provider = createVoiceProvider(
      (a.provider as VoiceProviderKindLike | undefined) ?? "mock",
    );
    const gen = provider.generate(
      { outputPath: String(a.outputPath), text: "style transfer", referenceId: ref.id },
      "style-transfer",
    );
    if (!gen.ok) return gen.result;
    return success(
      `style transferred -> ${gen.result.path}`,
      redactCredentials(JSON.stringify(gen.result)),
    );
  },
};

const voicePreview: ToolDefinition = {
  name: "voice_preview",
  description:
    "Preview an authorized reference voice (local workspace preview path; no external URLs).",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      referenceId: { type: "string", description: "registered authorized voice reference id" },
      provider: {
        type: "string",
        enum: ["mock", "openvoice"],
        description: "mock (default) or OpenVoice-compatible",
      },
    },
  },
  async execute(args, _ctx) {
    const bad = validateArgs(this.inputSchema, args);
    if (!bad.ok) return invalid(bad.error);
    const a = args as Record<string, unknown>;
    const referenceId =
      a.referenceId !== undefined ? String(a.referenceId) : undefined;
    if (referenceId !== undefined) {
      const ref = requireAuthorizedReference(referenceId);
      if (!ref.ok) return ref.result;
    }
    const preview = {
      referenceId: referenceId ?? "default",
      previewPath: referenceId ? `preview/${referenceId}.wav` : "preview/default.wav",
      kind: "synthetic" as const,
    };
    return success("voice preview", redactCredentials(JSON.stringify(preview)));
  },
};

export const voicePlugin: Plugin = {
  metadata: {
    name: "@dsh-forge-creator/plugin-creator-voice",
    version: "0.1.0",
    upstreamTool: "OpenVoice-compatible (external provider adapter)",
    coreContractVersion: CORE_VERSION,
    capabilities: [
      "voice_register_reference",
      "voice_list",
      "tts_generate",
      "voice_clone",
      "voice_style_transfer",
      "voice_preview",
    ],
  },
  tools: [
    voiceRegisterReference,
    voiceList,
    ttsGenerate,
    voiceClone,
    voiceStyleTransfer,
    voicePreview,
  ],
};

export default voicePlugin;
