/**
 * Creator validation & serialization (CREATOR-002).
 *
 * RED: validators below are stubs — they throw "not implemented". Tests are
 * failing. GREEN implements the real workspace/checksum/enum checks.
 */
import type {
  CreatorAsset,
  RightsMetadata,
  PlatformPostDraft,
  PublishResult,
  CredentialRef,
} from "./types.js";

export type ValidationResult<T = CreatorAsset> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

function notImplemented(name: string): never {
  throw new Error(`not implemented: ${name}`);
}

/** Validate a CreatorAsset: id, type, workspace-bounded path, non-empty checksum. */
export function validateCreatorAsset(
  _asset: CreatorAsset,
  _workspaceRoot: string,
): ValidationResult<CreatorAsset> {
  return notImplemented("validateCreatorAsset");
}

/** Validate RightsMetadata against the allowed status set. */
export function validateRights(
  _rights: RightsMetadata,
): { ok: true } | { ok: false; errors: string[] } {
  return notImplemented("validateRights");
}

/** Validate a PlatformPostDraft: platform + media that are all valid assets. */
export function validatePlatformPostDraft(
  _draft: PlatformPostDraft,
  _workspaceRoot: string,
): { ok: true; value: PlatformPostDraft } | { ok: false; errors: string[] } {
  return notImplemented("validatePlatformPostDraft");
}

/** Validate a PublishResult against the controlled status enum. */
export function validatePublishResult(
  _result: PublishResult,
): { ok: true; value: PublishResult } | { ok: false; errors: string[] } {
  return notImplemented("validatePublishResult");
}

/**
 * Serialize a CredentialRef. Only provider + key are ever emitted; any
 * extra field (e.g. a smuggled secret) is dropped.
 */
export function serializeCredentialRef(_ref: CredentialRef): string {
  return notImplemented("serializeCredentialRef");
}

/** Redact known secrets from model-visible text. */
export function sanitizeCredentialText(
  _text: string,
  _secrets: readonly string[],
): string {
  return notImplemented("sanitizeCredentialText");
}
