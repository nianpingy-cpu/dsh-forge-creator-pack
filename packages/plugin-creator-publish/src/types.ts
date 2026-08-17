/**
 * creator-publish domain types (CREATOR-013).
 */
export interface PublisherAccount {
  id: string;
  platform: string;
  handle: string;
  capabilities: readonly string[];
}

export interface PlatformCapabilities {
  platform: string;
  /** Media kinds the platform accepts for posts. */
  media: readonly ("image" | "video" | "audio" | "text")[];
  /** Whether the platform supports scheduled publishing. */
  scheduling: boolean;
  /** Whether the platform supports draft/API publishing. */
  apiPublish: boolean;
}

export type PublishProviderKind = "mock" | "postiz" | "official" | "local";

/** Outcome of a remote publish attempt. */
export type PublishAttemptStatus = "published" | "scheduled" | "unknown" | "failed";

export interface PostAttemptResult {
  postId: string;
  status: PublishAttemptStatus;
  error?: string;
}
