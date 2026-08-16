/**
 * creator-short-video domain types (CREATOR-008).
 */
export const SHORT_VIDEO_ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:5"] as const;
export type ShortVideoAspectRatio = (typeof SHORT_VIDEO_ASPECT_RATIOS)[number];

export const SHORT_VIDEO_VOICE_MODES = [
  "default",
  "male",
  "female",
  "narrator",
] as const;
export type ShortVideoVoiceMode = (typeof SHORT_VIDEO_VOICE_MODES)[number];

export const SHORT_VIDEO_SUBTITLE_MODES = ["none", "burned", "soft"] as const;
export type ShortVideoSubtitleMode = (typeof SHORT_VIDEO_SUBTITLE_MODES)[number];

export const SHORT_VIDEO_ASSET_STRATEGIES = ["stock", "ai", "existing"] as const;
export type ShortVideoAssetStrategy = (typeof SHORT_VIDEO_ASSET_STRATEGIES)[number];

/** Short-video duration bounds (seconds). */
export const SHORT_VIDEO_MIN_DURATION_SECONDS = 5;
export const SHORT_VIDEO_MAX_DURATION_SECONDS = 600;

/** Max status-poll attempts before a job is considered timed out. */
export const SHORT_VIDEO_STATUS_POLL_LIMIT = 10;

export interface ShortVideoPlan {
  script: string;
  aspectRatio: ShortVideoAspectRatio;
  /** Target duration in seconds. */
  durationTarget: number;
  voiceMode: ShortVideoVoiceMode;
  subtitleMode: ShortVideoSubtitleMode;
  assetStrategy: ShortVideoAssetStrategy;
  /** Workspace-relative output directory for generated assets. */
  outputDir: string;
}

export type ShortVideoJobStatus =
  | "queued"
  | "progressing"
  | "complete"
  | "failed";

export interface ShortVideoJob {
  id: string;
  plan: ShortVideoPlan;
  status: ShortVideoJobStatus;
  /** Number of status polls performed. */
  attempts: number;
  error?: string;
}

export interface ShortVideoAsset {
  kind: "video" | "audio" | "subtitle" | "thumbnail";
  /** Workspace-relative path (never an external URL). */
  path: string;
  aspectRatio: ShortVideoAspectRatio;
}

export type ShortVideoProviderKind = "mock" | "mpt";
