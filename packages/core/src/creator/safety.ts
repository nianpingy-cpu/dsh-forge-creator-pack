/**
 * Creator safety policy (CREATOR-003).
 *
 * Stricter external-side-effect policy than ordinary dev tools: approval
 * gates for every remote mutation, credential redaction, creator rights
 * policy, voice authorization guard, bypass-flag rejection and centralized
 * resource limits. Any plugin that declares a high-risk creator mutation
 * reuses these guards — no per-plugin reimplementation.
 *
 * SECURITY NOTE: approvals are minted by the DSH permission system, which is
 * the authority holder. Plugins only CHECK approvals; `createApproval` is a
 * test/dev helper and MUST NOT be reachable from untrusted input. There is no
 * per-approval secret token here (an unverified token would be forgeable and
 * give a false sense of security) — the meaningful bindings are scope,
 * content hash and expiry. Idempotency / duplicate-side-effect protection is
 * enforced by the publish layer (CREATOR-013) via CREATOR_DUPLICATE_SIDE_EFFECT_RISK.
 */
import { resolveInWorkspace } from "../workspace/policy.js";
import { creatorError } from "./errors.js";
import { sanitizeCredentialText } from "./validate.js";
import type {
  CreatorAsset,
  CreatorError,
  RightsMetadata,
} from "./types.js";

export const CREATOR_MUTATION_CLASSES = [
  "creator-read",
  "creator-workspace-write",
  "creator-network-read",
  "creator-remote-draft",
  "creator-remote-publish",
  "creator-remote-destructive",
  "creator-voice-sensitive",
] as const;
export type CreatorMutationClass = (typeof CREATOR_MUTATION_CLASSES)[number];

/** Defaults — centralized so plugins never hardcode their own. */
export const DEFAULT_NETWORK_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_MEDIA_FILE_SIZE_BYTES = 500 * 1024 * 1024;
export const DEFAULT_MAX_BATCH_ITEMS = 50;

export type CreatorApprovalScope = CreatorMutationClass | "all";

export interface CreatorApproval {
  contentHash: string;
  expiresAt: number;
  scope: CreatorApprovalScope;
}

export interface CreatorApprovalOptions {
  /** Approval lifetime in ms (default 15 min). */
  ttlMs?: number;
}

export type RightsPolicy = "strict" | "permissive";

export interface VoiceAuthorization {
  authorized: boolean;
  authorizationNote?: string;
}

export interface ResourceLimits {
  maxMediaFileSizeBytes?: number;
  maxNetworkTimeoutMs?: number;
  maxBatchItems?: number;
}

/** Build a typed CreatorError and throw it. */
function throwSafetyError(code: CreatorError["code"], message: string): never {
  throw creatorError(code, message);
}

/**
 * Create a time-boxed approval bound to a content hash.
 *
 * DEV/TEST helper — in production approvals are minted by the DSH permission
 * system. There is intentionally no secret token: the security boundary is
 * that only the permission system mints approvals, and plugins only check
 * scope / content-hash / expiry.
 */
export function createApproval(
  scope: CreatorApprovalScope,
  contentHash: string,
  options?: CreatorApprovalOptions,
): CreatorApproval {
  const ttlMs = options?.ttlMs ?? 15 * 60 * 1000;
  return { contentHash, expiresAt: Date.now() + ttlMs, scope };
}

/**
 * Approval gate. Throws a CreatorError when approval is missing, expired,
 * scope-mismatched or bound to a different content hash.
 */
export function assertCreatorApproval(
  approval: CreatorApproval | undefined,
  scope: CreatorMutationClass,
  contentHash: string,
  now: number = Date.now(),
): void {
  if (!approval) {
    throwSafetyError(
      "CREATOR_APPROVAL_REQUIRED",
      `approval required for ${scope}`,
    );
  }
  if (approval.scope !== scope && approval.scope !== "all") {
    throwSafetyError(
      "CREATOR_APPROVAL_REQUIRED",
      `approval for '${approval.scope}' does not cover '${scope}'`,
    );
  }
  // An "all" approval never authorizes the most sensitive mutations; those
  // always require an explicit approval scoped to their own class.
  if (
    approval.scope === "all" &&
    (scope === "creator-remote-destructive" ||
      scope === "creator-voice-sensitive")
  ) {
    throwSafetyError(
      "CREATOR_APPROVAL_REQUIRED",
      `an 'all' approval does not cover '${scope}'; an explicit '${scope}' approval is required`,
    );
  }
  if (approval.contentHash !== contentHash) {
    throwSafetyError(
      "CREATOR_APPROVAL_REQUIRED",
      "approval is bound to a different content hash (draft changed); re-approve the current content",
    );
  }
  if (approval.expiresAt <= now) {
    throwSafetyError("CREATOR_APPROVAL_EXPIRED", "approval has expired");
  }
}

/**
 * Reject an asset whose path escapes the workspace.
 *
 * Returns the canonical (realpathed) path so callers can bind their write to
 * the validated path and avoid a check-then-use (symlink-swap) gap.
 */
export function assertCreatorAssetInWorkspace(
  asset: CreatorAsset,
  workspaceRoot: string,
): string {
  if (!asset || typeof asset.path !== "string" || asset.path.trim() === "") {
    throwSafetyError(
      "CREATOR_OUTPUT_OUTSIDE_WORKSPACE",
      "asset.path is required and must resolve inside the workspace",
    );
  }
  try {
    return resolveInWorkspace(workspaceRoot, asset.path);
  } catch {
    throwSafetyError(
      "CREATOR_OUTPUT_OUTSIDE_WORKSPACE",
      `asset.path escapes the workspace boundary: ${asset.path}`,
    );
  }
}

/**
 * Rights policy gate. Under "strict", an asset without explicit rights
 * (or with status "unknown") is rejected.
 */
export function assertRightsPolicy(
  rights: RightsMetadata | undefined,
  policy: RightsPolicy,
): void {
  if (policy === "strict") {
    const status = rights?.status;
    if (!status || status === "unknown") {
      throwSafetyError(
        "CREATOR_RIGHTS_REQUIRED",
        "strict rights policy: explicit rights (owned / licensed / public-domain / permission-confirmed) are required before capture or reuse",
      );
    }
  }
}

/** Reject voice clone/transfer without explicit authorization. */
export function assertVoiceAuthorization(
  authorization: VoiceAuthorization | undefined,
): void {
  if (!authorization || authorization.authorized !== true) {
    throwSafetyError(
      "CREATOR_VOICE_AUTHORIZATION_REQUIRED",
      "voice cloning/transfer requires explicit authorization (authorization: true)",
    );
  }
}

const BYPASS_FLAG_KEYS = [
  "drmBypass",
  "captchaBypass",
  "antiDetection",
  "browserFingerprintSpoof",
  "bypassDrm",
  "bypassCaptcha",
  "disableCaptcha",
  "stripWatermark",
  "removeWatermark",
  "ignoreCopyright",
  "drm_bypass",
  "captcha_bypass",
  "anti_detection",
  "drm-bypass",
  "captcha-bypass",
  "anti-detection",
];

/**
 * Reject DRM-bypass / CAPTCHA-bypass / anti-detection flags, including
 * nested occurrences. A denylist is a first line of defence — the real
 * control is typed-argv allowlisting in each plugin (ADR-004), so tools must
 * never pass arbitrary extra args through to a provider.
 */
export function assertNoBypassFlags(
  options: Record<string, unknown>,
): void {
  if (!options || typeof options !== "object") return;
  walkBypassFlags(options, []);
}

function walkBypassFlags(value: unknown, path: string[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walkBypassFlags(item, path);
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const keyLower = key.toLowerCase();
    if (BYPASS_FLAG_KEYS.some((k) => k.toLowerCase() === keyLower)) {
      throwSafetyError(
        "CREATOR_UNSUPPORTED_CAPABILITY",
        `forbidden option: ${[...path, key].join(".")} — DRM-bypass / CAPTCHA-bypass / anti-detection is not allowed`,
      );
    }
    walkBypassFlags(child, [...path, key]);
  }
}

/**
 * Reject any result carrying a known credential in plaintext before it
 * reaches the model.
 */
/** Stringify for scanning without throwing on circular/BigInt values. */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value);
  }
}

export function assertNoCredentialPlaintext(
  result: unknown,
  secrets: readonly string[],
): void {
  const text = safeStringify(result);
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length > 0 && text.includes(secret)) {
      throwSafetyError(
        "CREATOR_CREDENTIAL_LEAK",
        "result contains a credential in plaintext; redact it before returning to the model",
      );
    }
  }
}

/** Redact known credentials before text reaches a logger / the model. */
export function redactForLogger(
  text: string,
  secrets: readonly string[],
): string {
  return sanitizeCredentialText(text, secrets);
}

/** Enforce centralized resource limits. */
export function assertWithinResourceLimits(
  input: { sizeBytes?: number; timeoutMs?: number; batchItems?: number },
  limits?: ResourceLimits,
): void {
  const maxSize = limits?.maxMediaFileSizeBytes ?? DEFAULT_MAX_MEDIA_FILE_SIZE_BYTES;
  const maxTimeout = limits?.maxNetworkTimeoutMs ?? DEFAULT_NETWORK_TIMEOUT_MS;
  const maxBatch = limits?.maxBatchItems ?? DEFAULT_MAX_BATCH_ITEMS;
  if (input.sizeBytes !== undefined && input.sizeBytes > maxSize) {
    throwSafetyError(
      "CREATOR_RESOURCE_LIMIT_EXCEEDED",
      `media size ${input.sizeBytes} bytes exceeds the ${maxSize}-byte limit`,
    );
  }
  if (input.timeoutMs !== undefined && input.timeoutMs > maxTimeout) {
    throwSafetyError(
      "CREATOR_RESOURCE_LIMIT_EXCEEDED",
      `timeout ${input.timeoutMs}ms exceeds the ${maxTimeout}ms limit`,
    );
  }
  if (input.batchItems !== undefined && input.batchItems > maxBatch) {
    throwSafetyError(
      "CREATOR_RESOURCE_LIMIT_EXCEEDED",
      `batch items ${input.batchItems} exceeds the ${maxBatch}-item limit`,
    );
  }
}

/** Map a violation to a typed CreatorError for plugin-facing use. */
export function safetyError(
  code: CreatorError["code"],
  message: string,
): CreatorError {
  return creatorError(code, message);
}

