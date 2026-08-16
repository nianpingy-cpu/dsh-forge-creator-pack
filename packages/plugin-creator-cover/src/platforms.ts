/**
 * creator-cover platform profiles (CREATOR-009).
 *
 * Platform dimensions are centralized here with source notes — never
 * scattered literals in tools.
 */
export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PlatformProfile {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Pixel insets defining the publishable safe area. */
  safeArea: SafeArea;
  /** Max characters for the title inside the safe area. */
  maxTitleLength: number;
  /** Max characters for the subject/description inside the safe area. */
  maxSubjectLength: number;
  /** Source note for the dimension spec. */
  source: string;
}

export const PLATFORM_PROFILES: readonly PlatformProfile[] = [
  {
    id: "youtube-thumbnail",
    name: "YouTube thumbnail",
    width: 1280,
    height: 720,
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    maxTitleLength: 60,
    maxSubjectLength: 40,
    source: "YouTube Help — recommended thumbnail 1280x720 (16:9)",
  },
  {
    id: "bilibili-cover",
    name: "Bilibili cover",
    width: 1146,
    height: 717,
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    maxTitleLength: 30,
    maxSubjectLength: 30,
    source: "Bilibili recommended cover 1146x717 (16:10)",
  },
  {
    id: "xiaohongshu-portrait",
    name: "Xiaohongshu portrait",
    width: 1080,
    height: 1440,
    safeArea: { top: 120, right: 60, bottom: 120, left: 60 },
    maxTitleLength: 40,
    maxSubjectLength: 30,
    source: "Xiaohongshu portrait cover 1080x1440 (3:4), keep text within margins",
  },
  {
    id: "douyin-vertical",
    name: "Douyin vertical",
    width: 1080,
    height: 1920,
    safeArea: { top: 160, right: 80, bottom: 240, left: 80 },
    maxTitleLength: 50,
    maxSubjectLength: 40,
    source: "Douyin vertical cover 1080x1920 (9:16), keep UI-safe margins",
  },
  {
    id: "wechat-article-cover",
    name: "WeChat article cover",
    width: 900,
    height: 383,
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    maxTitleLength: 40,
    maxSubjectLength: 30,
    source: "WeChat article headline image ratio ~2.35:1 (900x383)",
  },
  {
    id: "x-image",
    name: "X (Twitter) in-stream image",
    width: 1600,
    height: 900,
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    maxTitleLength: 80,
    maxSubjectLength: 50,
    source: "X/Twitter in-stream image recommendation 1600x900 (16:9)",
  },
];

export function getProfile(id: string): PlatformProfile | undefined {
  return PLATFORM_PROFILES.find((p) => p.id === id);
}

export const PLATFORM_PROFILE_IDS = PLATFORM_PROFILES.map((p) => p.id);
