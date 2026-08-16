/**
 * Creator Domain types (CREATOR-002).
 *
 * Shared contracts for all Creator Pack plugins: assets, rights, publish
 * drafts/results, credential references and the provider base contract.
 * Plugins MUST reuse these types — never re-declare their own.
 */

/** Kinds of media a creator asset can be. */
export const ASSET_TYPES = [
  "video",
  "audio",
  "image",
  "subtitle",
  "document",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

/** Rights / provenance status of an asset. */
export const RIGHTS_STATUSES = [
  "owned",
  "licensed",
  "public-domain",
  "permission-confirmed",
  "unknown",
] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export interface RightsMetadata {
  status: RightsStatus;
  sourceUrl?: string;
  attribution?: string;
  note?: string;
}

/** A creator asset: a file inside the workspace with checksum + provenance. */
export interface CreatorAsset {
  id: string;
  path: string;
  type: AssetType;
  mimeType?: string;
  source?: string;
  checksum: string;
  rights?: RightsMetadata;
  metadata?: Record<string, unknown>;
}

/**
 * A reference to a stored credential. It is ONLY a reference — it must never
 * carry a secret value, token, cookie or API key (enforced by
 * `serializeCredentialRef`).
 */
export interface CredentialRef {
  provider: string;
  key: string;
}

/** Controlled publish statuses. */
export const PUBLISH_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "failed",
] as const;
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

export interface PlatformPostDraft {
  platform: string;
  title?: string;
  text?: string;
  media: CreatorAsset[];
  tags?: string[];
  scheduledAt?: string;
  visibility?: string;
}

export interface PublishResult {
  platform: string;
  status: PublishStatus;
  remoteId?: string;
  url?: string;
  error?: string;
}

/** Normalized creator error codes (CREATOR-003 expands usage). */
export const CREATOR_ERROR_CODES = [
  "CREATOR_PROVIDER_UNAVAILABLE",
  "CREATOR_PROVIDER_TIMEOUT",
  "CREATOR_INVALID_ASSET",
  "CREATOR_RIGHTS_REQUIRED",
  "CREATOR_APPROVAL_REQUIRED",
  "CREATOR_APPROVAL_EXPIRED",
  "CREATOR_CREDENTIAL_MISSING",
  "CREATOR_OUTPUT_OUTSIDE_WORKSPACE",
  "CREATOR_UNSUPPORTED_CAPABILITY",
  "CREATOR_REMOTE_STATE_UNKNOWN",
  "CREATOR_DUPLICATE_SIDE_EFFECT_RISK",
  "CREATOR_VOICE_AUTHORIZATION_REQUIRED",
  "CREATOR_RESOURCE_LIMIT_EXCEEDED",
] as const;
export type CreatorErrorCode = (typeof CREATOR_ERROR_CODES)[number];

export interface CreatorError {
  code: CreatorErrorCode;
  message: string;
  /** Structured context only — never a raw stack trace. */
  context?: Record<string, unknown>;
}

/** Provider base contract: named capability set, normalized checks. */
export interface CreatorProvider {
  readonly name: string;
  readonly capabilities: readonly string[];
}
