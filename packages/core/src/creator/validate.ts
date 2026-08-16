/**
 * Creator validation & serialization (CREATOR-002).
 *
 * GREEN: real workspace/checksum/enum checks. Assets are workspace-bounded
 * (via the core workspace policy), checksums must be non-empty, rights and
 * publish statuses are controlled enums, and CredentialRef serialization
 * can never emit a secret value.
 */
import { resolveInWorkspace } from "../workspace/policy.js";
import {
  ASSET_TYPES,
  RIGHTS_STATUSES,
  PUBLISH_STATUSES,
  type CreatorAsset,
  type RightsMetadata,
  type PlatformPostDraft,
  type PublishResult,
  type CredentialRef,
} from "./types.js";

export type ValidationResult<T = CreatorAsset> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

function inList(list: readonly string[], value: string): boolean {
  return (list as readonly string[]).includes(value);
}

/**
 * Validate a CreatorAsset: id, type, workspace-bounded path, non-empty checksum.
 *
 * NOTE: validation confirms the path is inside the workspace; callers that
 * write the file must still re-resolve the canonical path via
 * `resolveInWorkspace` at write time (symlink-swap guard).
 */
export function validateCreatorAsset(
  asset: CreatorAsset,
  workspaceRoot: string,
): ValidationResult<CreatorAsset> {
  const errors: string[] = [];
  if (!asset || typeof asset !== "object") {
    return { ok: false, errors: ["asset must be an object"] };
  }
  if (typeof asset.id !== "string" || asset.id.trim() === "") {
    errors.push("asset.id is required");
  }
  if (typeof asset.type !== "string" || !inList(ASSET_TYPES, asset.type)) {
    errors.push(`invalid asset.type: ${String(asset.type)}`);
  }
  if (
    typeof asset.checksum !== "string" ||
    asset.checksum.trim() === ""
  ) {
    errors.push("asset.checksum is required");
  }
  if (typeof asset.path !== "string" || asset.path.trim() === "") {
    errors.push("asset.path is required");
  } else {
    try {
      resolveInWorkspace(workspaceRoot, asset.path);
    } catch {
      errors.push("asset.path escapes the workspace boundary");
    }
  }
  if (asset.rights && typeof asset.rights === "object") {
    const r = validateRights(asset.rights);
    if (!r.ok) errors.push(...r.errors.map((e) => `rights: ${e}`));
  }
  return errors.length === 0 ? { ok: true, value: asset } : { ok: false, errors };
}

/** Validate RightsMetadata against the allowed status set. */
export function validateRights(
  rights: RightsMetadata,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!rights || typeof rights !== "object") {
    return { ok: false, errors: ["rights must be an object"] };
  }
  if (!inList(RIGHTS_STATUSES, rights.status)) {
    errors.push(`invalid rights.status: ${String(rights.status)}`);
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * Validate a PlatformPostDraft: platform + media elements (when present) that
 * are all valid assets. A text-only draft (empty media) is permitted.
 */
export function validatePlatformPostDraft(
  draft: PlatformPostDraft,
  workspaceRoot: string,
): { ok: true; value: PlatformPostDraft } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!draft || typeof draft !== "object") {
    return { ok: false, errors: ["draft must be an object"] };
  }
  if (typeof draft.platform !== "string" || draft.platform.trim() === "") {
    errors.push("draft.platform is required");
  }
  if (!Array.isArray(draft.media)) {
    errors.push("draft.media must be an array");
  } else {
    for (const media of draft.media) {
      const r = validateCreatorAsset(media, workspaceRoot);
      if (!r.ok) errors.push(...r.errors.map((e) => `media: ${e}`));
    }
  }
  if (draft.tags !== undefined && !Array.isArray(draft.tags)) {
    errors.push("draft.tags must be an array");
  }
  if (draft.scheduledAt !== undefined && typeof draft.scheduledAt !== "string") {
    errors.push("draft.scheduledAt must be a string");
  }
  if (draft.visibility !== undefined && typeof draft.visibility !== "string") {
    errors.push("draft.visibility must be a string");
  }
  return errors.length === 0 ? { ok: true, value: draft } : { ok: false, errors };
}

/** Validate a PublishResult against the controlled status enum. */
export function validatePublishResult(
  result: PublishResult,
): { ok: true; value: PublishResult } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!result || typeof result !== "object") {
    return { ok: false, errors: ["result must be an object"] };
  }
  if (typeof result.platform !== "string" || result.platform.trim() === "") {
    errors.push("result.platform is required");
  }
  if (!inList(PUBLISH_STATUSES, result.status)) {
    errors.push(`invalid publish status: ${String(result.status)}`);
  }
  return errors.length === 0 ? { ok: true, value: result } : { ok: false, errors };
}

/**
 * Serialize a CredentialRef. Only provider + key are ever emitted; any
 * extra field (e.g. a smuggled secret) is dropped — serialized output can
 * never leak a credential value.
 */
export function serializeCredentialRef(ref: CredentialRef): string {
  return JSON.stringify({
    provider: String(ref?.provider ?? ""),
    key: String(ref?.key ?? ""),
  });
}

/** Redact known secrets from model-visible text. */
export function sanitizeCredentialText(
  text: string,
  secrets: readonly string[],
): string {
  let out = text;
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length > 0) {
      out = out.split(secret).join("[REDACTED]");
    }
  }
  return out;
}
