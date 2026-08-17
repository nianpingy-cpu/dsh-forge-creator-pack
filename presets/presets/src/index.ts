/**
 * Creator Pack presets (CREATOR-015) — composition and configuration only.
 *
 * A preset is a manifest that references already-implemented plugin packages
 * and the creator skills (skills/creator/*.md) that guide their use; no
 * plugin code is duplicated here. The harness host can load a preset and
 * register every plugin/tool it references.
 */
import { CORE_VERSION, type Plugin } from "@dsh-forge-creator/core";
import { radarPlugin } from "@dsh-forge-creator/plugin-creator-radar";
import { capturePlugin } from "@dsh-forge-creator/plugin-creator-capture";
import { transcribePlugin } from "@dsh-forge-creator/plugin-creator-transcribe";
import { creatorClipsPlugin } from "@dsh-forge-creator/plugin-creator-clips";
import { shortVideoPlugin } from "@dsh-forge-creator/plugin-creator-short-video";
import { coverPlugin } from "@dsh-forge-creator/plugin-creator-cover";
import { voicePlugin } from "@dsh-forge-creator/plugin-creator-voice";
import { localizePlugin } from "@dsh-forge-creator/plugin-creator-localize";
import { motionPlugin } from "@dsh-forge-creator/plugin-creator-motion";
import { publishPlugin } from "@dsh-forge-creator/plugin-creator-publish";
import { ffmpegPlugin } from "@dsh-forge-creator/plugin-ffmpeg";

export interface CreatorPreset {
  name: "creator-research" | "creator-video" | "creator-publisher" | "creator-full";
  description: string;
  /** Plugins in registration order; no duplicate plugin/tool registrations. */
  plugins: readonly Plugin[];
  /** Skill slugs under skills/creator/ referenced by this preset. */
  skills: readonly string[];
}

/** Static assertion that every plugin targets the current core version. */
const ALL_CREATOR = Object.freeze([
  radarPlugin,
  capturePlugin,
  transcribePlugin,
  creatorClipsPlugin,
  shortVideoPlugin,
  coverPlugin,
  voicePlugin,
  localizePlugin,
  motionPlugin,
  publishPlugin,
  ffmpegPlugin,
] as const satisfies readonly Plugin[]);

const ALL_CREATOR_PACKAGES = ALL_CREATOR.map((p) => p.metadata.name);

export const PRESETS: readonly CreatorPreset[] = Object.freeze([
  Object.freeze({
    name: "creator-research",
    description:
      "Topic discovery to licensed capture: radar (trends/opportunities), capture (media inspection + rights-confirmed download), transcribe (speech to text).",
    plugins: Object.freeze([radarPlugin, capturePlugin, transcribePlugin]),
    skills: Object.freeze(["topic-to-outline"]),
  }),
  Object.freeze({
    name: "creator-video",
    description:
      "Long-form to short-form production: transcribe, clips (time/chapter/transcript), short-video (plan/generate), cover, voice, localize, motion, and the ffmpeg media adapter.",
    plugins: Object.freeze([
      transcribePlugin,
      creatorClipsPlugin,
      shortVideoPlugin,
      coverPlugin,
      voicePlugin,
      localizePlugin,
      motionPlugin,
      ffmpegPlugin,
    ]),
    skills: Object.freeze(["short-video-script", "platform-repurpose"]),
  }),
  Object.freeze({
    name: "creator-publisher",
    description:
      "Controlled multi-platform publishing: cover assets plus the approval-gated publish lifecycle (draft -> validate -> preview -> explicit approval -> publish/schedule), guided by the platform-specific creator skills.",
    plugins: Object.freeze([coverPlugin, publishPlugin]),
    skills: Object.freeze([
      "xiaohongshu-writing",
      "bilibili-metadata",
      "youtube-metadata",
      "creator-humanize",
    ]),
  }),
  Object.freeze({
    name: "creator-full",
    description: "All Creator Pack capabilities (every creator plugin + the ffmpeg media adapter) with all 7 creator skills.",
    plugins: ALL_CREATOR,
    skills: Object.freeze([
      "topic-to-outline",
      "short-video-script",
      "platform-repurpose",
      "xiaohongshu-writing",
      "bilibili-metadata",
      "youtube-metadata",
      "creator-humanize",
    ]),
  }),
]);

/** Convenience: all plugin package names shipped by creator-full. */
export const ALL_CREATOR_PLUGIN_PACKAGES: readonly string[] =
  ALL_CREATOR_PACKAGES;

export { CORE_VERSION };
