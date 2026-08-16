import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { localizePlugin } from "@dsh-forge-creator/plugin-creator-localize";
import { voicePlugin } from "@dsh-forge-creator/plugin-creator-voice";
import { createE2E, writeFixture } from "./harness.js";

const SRT = `1
00:00:00,000 --> 00:00:01,200
Hello world

2
00:00:01,400 --> 00:00:03,000
Welcome to this episode
`;

/**
 * Story C — 海外本地化 (overseas localization).
 *
 * fixture subtitle -> translate -> align -> optional TTS mock -> localized
 * asset. Deterministic via mock providers; no external accounts.
 */
describe("E2E Story C — 海外本地化 (CREATOR-015)", () => {
  const e2e = createE2E([localizePlugin, voicePlugin]);

  it("runs translate -> align -> tts -> localized asset end to end", async () => {
    // fixture subtitle
    writeFixture(e2e.workspaceRoot, "source.srt", SRT);

    // 1. translate (mock provider prefixes target language)
    const translated = await e2e.invoke("subtitle_translate", {
      inputPath: "source.srt",
      sourceLanguage: "en",
      targetLanguage: "fr",
      outputPath: "tr.srt",
      provider: "mock",
    });
    expect(translated.ok).toBe(true);
    expect(existsSync(join(e2e.workspaceRoot, "tr.srt"))).toBe(true);

    // 2. align (positive offset, stays within valid timestamps)
    const aligned = await e2e.invoke("subtitle_align", {
      inputPath: "tr.srt",
      offsetMs: 100,
      outputPath: "al.srt",
    });
    expect(aligned.ok).toBe(true);
    expect(existsSync(join(e2e.workspaceRoot, "al.srt"))).toBe(true);

    // 3. optional TTS mock -> localized voice asset
    const tts = await e2e.invoke("tts_generate", {
      text: "Bonjour le monde",
      outputPath: "voice.wav",
      provider: "mock",
    });
    expect(tts.ok).toBe(true);
    expect(existsSync(join(e2e.workspaceRoot, "voice.wav"))).toBe(true);

    // 4. localized asset (wraps the aligned translated subtitle)
    const localized = await e2e.invoke("localize_video", {
      subtitlePath: "al.srt",
      sourceLanguage: "en",
      targetLanguage: "fr",
      outputDir: "loc",
      provider: "mock",
    });
    expect(localized.ok).toBe(true);
    const asset = JSON.parse(localized.raw!) as { path?: string; assets?: unknown[] };
    expect(asset).toBeDefined();
    const content = readFileSync(join(e2e.workspaceRoot, "tr.srt"), "utf8");
    expect(content).toContain("fr");
  });
});
