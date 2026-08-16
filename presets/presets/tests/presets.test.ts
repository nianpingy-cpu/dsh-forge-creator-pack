import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CORE_VERSION, type Plugin } from "@dsh-forge-creator/core";
import { PRESETS } from "@dsh-forge-creator/presets";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SKILLS_DIR = join(REPO_ROOT, "skills", "creator");

/**
 * Taskbook §20 preset definitions, keyed by preset name -> expected plugin
 * package names (metadata.name), exactly as authored.
 */
const EXPECTED_PLUGINS: Record<string, readonly string[]> = {
  "creator-research": [
    "@dsh-forge-creator/plugin-creator-radar",
    "@dsh-forge-creator/plugin-creator-capture",
    "@dsh-forge-creator/plugin-creator-transcribe",
  ],
  "creator-video": [
    "@dsh-forge-creator/plugin-creator-transcribe",
    "@dsh-forge-creator/plugin-creator-clips",
    "@dsh-forge-creator/plugin-creator-short-video",
    "@dsh-forge-creator/plugin-creator-cover",
    "@dsh-forge-creator/plugin-creator-voice",
    "@dsh-forge-creator/plugin-creator-localize",
    "@dsh-forge-creator/plugin-creator-motion",
    "@dsh-forge-creator/plugin-ffmpeg",
  ],
  "creator-publisher": [
    "@dsh-forge-creator/plugin-creator-cover",
    "@dsh-forge-creator/plugin-creator-publish",
  ],
  "creator-full": [
    "@dsh-forge-creator/plugin-creator-radar",
    "@dsh-forge-creator/plugin-creator-capture",
    "@dsh-forge-creator/plugin-creator-transcribe",
    "@dsh-forge-creator/plugin-creator-clips",
    "@dsh-forge-creator/plugin-creator-short-video",
    "@dsh-forge-creator/plugin-creator-cover",
    "@dsh-forge-creator/plugin-creator-voice",
    "@dsh-forge-creator/plugin-creator-localize",
    "@dsh-forge-creator/plugin-creator-motion",
    "@dsh-forge-creator/plugin-creator-publish",
    "@dsh-forge-creator/plugin-ffmpeg",
  ],
};

/** Taskbook §20 preset -> skill slugs under skills/creator/. */
const EXPECTED_SKILLS: Record<string, readonly string[]> = {
  "creator-research": ["topic-to-outline"],
  "creator-video": ["short-video-script", "platform-repurpose"],
  "creator-publisher": [
    "xiaohongshu-writing",
    "bilibili-metadata",
    "youtube-metadata",
    "creator-humanize",
  ],
  "creator-full": [
    "topic-to-outline",
    "short-video-script",
    "platform-repurpose",
    "xiaohongshu-writing",
    "bilibili-metadata",
    "youtube-metadata",
    "creator-humanize",
  ],
};

const packageNames = (plugins: readonly Plugin[]) =>
  plugins.map((p) => p.metadata.name).sort();

const toolNames = (plugins: readonly Plugin[]) =>
  plugins.flatMap((p) => p.tools.map((t) => t.name));

describe("creator presets (CREATOR-015)", () => {
  it("ships exactly the 4 taskbook presets", () => {
    expect(PRESETS.map((p) => p.name).sort()).toEqual(
      ["creator-research", "creator-video", "creator-publisher", "creator-full"].sort(),
    );
  });

  it.each(Object.keys(EXPECTED_PLUGINS))(
    "preset %s references exactly the taskbook plugin set",
    (name) => {
      const preset = PRESETS.find((p) => p.name === name);
      expect(preset, `missing preset ${name}`).toBeDefined();
      expect(packageNames(preset!.plugins)).toEqual(
        [...EXPECTED_PLUGINS[name]!].sort(),
      );
    },
  );

  it("registers no duplicate tool across any preset", () => {
    for (const preset of PRESETS) {
      const names = toolNames(preset.plugins);
      expect(new Set(names).size, `${preset.name} has tool collisions`).toBe(
        names.length,
      );
    }
  });

  it("declares skills that exist under skills/creator/", () => {
    for (const preset of PRESETS) {
      const skills = EXPECTED_SKILLS[preset.name] ?? [];
      expect(skills.length, `${preset.name} expected skill list`).toBeGreaterThan(0);
      for (const slug of skills) {
        expect(
          existsSync(join(SKILLS_DIR, `${slug}.md`)),
          `${preset.name} references missing skill ${slug}.md`,
        ).toBe(true);
      }
      expect(preset.skills).toEqual([...skills].sort());
    }
  });

  it("creator-full is the union of research + video + publisher plugins", () => {
    const full = PRESETS.find((p) => p.name === "creator-full")!;
    const union = new Set<string>([
      ...EXPECTED_PLUGINS["creator-research"]!,
      ...EXPECTED_PLUGINS["creator-video"]!,
      ...EXPECTED_PLUGINS["creator-publisher"]!,
    ]);
    expect(new Set(packageNames(full.plugins))).toEqual(union);
  });

  it("every plugin in every preset targets the current core contract version", () => {
    for (const preset of PRESETS) {
      for (const plugin of preset.plugins) {
        expect(plugin.metadata.coreContractVersion).toBe(CORE_VERSION);
      }
    }
  });
});
