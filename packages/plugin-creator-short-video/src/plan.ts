/**
 * creator-short-video plan validation (CREATOR-008).
 *
 * The Plan Schema is centralized here (script, aspectRatio, durationTarget,
 * voiceMode, subtitleMode, assetStrategy, outputDir) with allowed-value sets
 * from types.ts — nothing hardcoded in the tools.
 */
import {
  SHORT_VIDEO_ASPECT_RATIOS,
  SHORT_VIDEO_VOICE_MODES,
  SHORT_VIDEO_SUBTITLE_MODES,
  SHORT_VIDEO_ASSET_STRATEGIES,
  SHORT_VIDEO_MIN_DURATION_SECONDS,
  SHORT_VIDEO_MAX_DURATION_SECONDS,
  type ShortVideoAspectRatio,
  type ShortVideoVoiceMode,
  type ShortVideoSubtitleMode,
  type ShortVideoAssetStrategy,
  type ShortVideoPlan,
} from "./types.js";

const DEFAULT_ASPECT_RATIO: ShortVideoAspectRatio = "9:16";
const DEFAULT_VOICE_MODE: ShortVideoVoiceMode = "default";
const DEFAULT_SUBTITLE_MODE: ShortVideoSubtitleMode = "burned";
const DEFAULT_ASSET_STRATEGY: ShortVideoAssetStrategy = "stock";
const DEFAULT_DURATION = 30;
const DEFAULT_OUTPUT_DIR = "short-video";

export type PlanInput = {
  topic?: string;
  script?: string;
  aspectRatio?: string;
  durationTarget?: number;
  voiceMode?: string;
  subtitleMode?: string;
  assetStrategy?: string;
  outputDir?: string;
};

export type PlanOutcome =
  | { ok: true; plan: ShortVideoPlan }
  | { ok: false; message: string };

/**
 * Control characters (C0 + DEL) that must not appear in a workspace path.
 * Built via String.fromCharCode so the regex literal contains no control
 * characters (satisfies eslint no-control-regex). Non-global so .test() is
 * stateless.
 */
const CONTROL_CHARS = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
);

/** True when the string contains control characters or a leading dash. */
function isUnsafePath(s: string): boolean {
  return s.trim() === "" || /^\s*-/.test(s) || CONTROL_CHARS.test(s);
}

/**
 * Validate a raw plan input into a complete ShortVideoPlan, filling defaults.
 * Rejects unsupported aspect ratios, out-of-range durations, unknown modes,
 * and unsafe output directories.
 */
export function validatePlan(input: PlanInput): PlanOutcome {
  const script = input.script?.trim();
  const topic = input.topic?.trim();
  if (!script && !topic) {
    return { ok: false, message: "plan requires a script or a topic" };
  }
  const aspectRatio = (input.aspectRatio ?? DEFAULT_ASPECT_RATIO) as ShortVideoAspectRatio;
  if (!SHORT_VIDEO_ASPECT_RATIOS.includes(aspectRatio)) {
    return {
      ok: false,
      message: `unsupported aspect ratio "${aspectRatio}"; allowed: ${SHORT_VIDEO_ASPECT_RATIOS.join(", ")}`,
    };
  }
  const durationTarget = input.durationTarget ?? DEFAULT_DURATION;
  if (
    !Number.isFinite(durationTarget) ||
    durationTarget < SHORT_VIDEO_MIN_DURATION_SECONDS ||
    durationTarget > SHORT_VIDEO_MAX_DURATION_SECONDS
  ) {
    return {
      ok: false,
      message: `durationTarget must be ${SHORT_VIDEO_MIN_DURATION_SECONDS}..${SHORT_VIDEO_MAX_DURATION_SECONDS} seconds`,
    };
  }
  const voiceMode = (input.voiceMode ?? DEFAULT_VOICE_MODE) as ShortVideoVoiceMode;
  if (!SHORT_VIDEO_VOICE_MODES.includes(voiceMode)) {
    return {
      ok: false,
      message: `unsupported voiceMode "${voiceMode}"; allowed: ${SHORT_VIDEO_VOICE_MODES.join(", ")}`,
    };
  }
  const subtitleMode = (input.subtitleMode ?? DEFAULT_SUBTITLE_MODE) as ShortVideoSubtitleMode;
  if (!SHORT_VIDEO_SUBTITLE_MODES.includes(subtitleMode)) {
    return {
      ok: false,
      message: `unsupported subtitleMode "${subtitleMode}"; allowed: ${SHORT_VIDEO_SUBTITLE_MODES.join(", ")}`,
    };
  }
  const assetStrategy = (input.assetStrategy ?? DEFAULT_ASSET_STRATEGY) as ShortVideoAssetStrategy;
  if (!SHORT_VIDEO_ASSET_STRATEGIES.includes(assetStrategy)) {
    return {
      ok: false,
      message: `unsupported assetStrategy "${assetStrategy}"; allowed: ${SHORT_VIDEO_ASSET_STRATEGIES.join(", ")}`,
    };
  }
  const outputDir = input.outputDir ?? DEFAULT_OUTPUT_DIR;
  if (isUnsafePath(outputDir)) {
    return {
      ok: false,
      message: "outputDir must be a non-empty workspace-relative directory path",
    };
  }
  const finalScript = script ?? `Short video about ${topic}`;
  return {
    ok: true,
    plan: {
      script: finalScript,
      aspectRatio,
      durationTarget,
      voiceMode,
      subtitleMode,
      assetStrategy,
      outputDir,
    },
  };
}

/** A mock-derived script when only a topic is supplied. */
export function deriveScript(plan: ShortVideoPlan): string {
  return plan.script;
}
