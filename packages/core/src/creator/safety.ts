/**
 * Creator safety policy (CREATOR-003).
 *
 * RED: guards below are stubs — they throw "not implemented". Tests are
 * failing. GREEN implements the approval gate, credential redaction, rights
 * policy, voice authorization guard, bypass-flag rejection and resource
 * limits.
 */
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
  token: string;
  contentHash: string;
  expiresAt: number;
  scope: CreatorApprovalScope;
}

export interface CreatorApprovalOptions {
  /** Approval lifetime in ms (default 15 min). */
  ttlMs?: number;
  token?: string;
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

function notImplemented(name: string): never {
  throw new Error(`not implemented: ${name}`);
}

/** Create a time-boxed approval bound to a content hash. */
export function createApproval(
  _scope: CreatorApprovalScope,
  _contentHash: string,
  _options?: CreatorApprovalOptions,
): CreatorApproval {
  return notImplemented("createApproval");
}

/**
 * Approval gate. Throws a CreatorError when approval is missing, expired,
 * scope-mismatched or bound to a different content hash.
 */
export function assertCreatorApproval(
  _approval: CreatorApproval | undefined,
  _scope: CreatorMutationClass,
  _contentHash: string,
  _now?: number,
): void {
  return notImplemented("assertCreatorApproval");
}

/** Reject an asset whose path escapes the workspace. */
export function assertCreatorAssetInWorkspace(
  _asset: CreatorAsset,
  _workspaceRoot: string,
): void {
  return notImplemented("assertCreatorAssetInWorkspace");
}

/**
 * Rights policy gate. Under "strict", an asset without explicit rights
 * (or with status "unknown") is rejected.
 */
export function assertRightsPolicy(
  _rights: RightsMetadata | undefined,
  _policy: RightsPolicy,
): void {
  return notImplemented("assertRightsPolicy");
}

/** Reject voice clone/transfer without explicit authorization. */
export function assertVoiceAuthorization(
  _authorization: VoiceAuthorization | undefined,
): void {
  return notImplemented("assertVoiceAuthorization");
}

/** Reject DRM-bypass / CAPTCHA-bypass / anti-detection flags. */
export function assertNoBypassFlags(
  _options: Record<string, unknown>,
): void {
  return notImplemented("assertNoBypassFlags");
}

/**
 * Reject any result carrying a known credential in plaintext before it
 * reaches the model.
 */
export function assertNoCredentialPlaintext(
  _result: unknown,
  _secrets: readonly string[],
): void {
  return notImplemented("assertNoCredentialPlaintext");
}

/** Redact known credentials before text reaches a logger / the model. */
export function redactForLogger(
  _text: string,
  _secrets: readonly string[],
): string {
  return notImplemented("redactForLogger");
}

/** Enforce centralized resource limits. */
export function assertWithinResourceLimits(
  _input: { sizeBytes?: number; timeoutMs?: number; batchItems?: number },
  _limits?: ResourceLimits,
): void {
  return notImplemented("assertWithinResourceLimits");
}

/** Map a violation to a typed CreatorError for plugin-facing use. */
export function safetyError(
  _code: CreatorError["code"],
  _message: string,
): CreatorError {
  return notImplemented("safetyError");
}
