import { describe, expect, it, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { transcribePlugin } from "@dsh-forge-creator/plugin-creator-transcribe";
import { creatorClipsPlugin } from "@dsh-forge-creator/plugin-creator-clips";
import { createE2E, writeFixture } from "./harness.js";

interface Transcript {
  segments: Array<{ id: number; startMs: number; endMs: number; text: string }>;
  language?: string;
  provider?: string;
}

/**
 * Story B — 长视频到短视频 (long video to short).
 *
 * fixture video -> transcribe -> choose segment -> clip -> vertical variant ->
 * subtitle. Deterministic: transcribe uses the mock provider, clips use the
 * canned ffmpeg/ffprobe runner (10s input, 9:16 vertical output).
 */
describe("E2E Story B — 长视频到短视频 (CREATOR-015)", () => {
  const e2e = createE2E([transcribePlugin, creatorClipsPlugin]);
  afterAll(() => e2e.cleanup());

  it("runs transcribe -> clip -> vertical -> subtitle end to end", async () => {
    // fixture video
    writeFixture(e2e.workspaceRoot, "long.mp4");

    // 1. transcribe (mock provider, deterministic segments)
    const tr = await e2e.invoke("transcribe_media", { audio: "long.mp4" });
    expect(tr.ok).toBe(true);
    const transcript = JSON.parse(tr.raw!) as Transcript;
    expect(transcript.segments.length).toBeGreaterThan(0);
    expect(transcript.provider).toBe("mock");

    // 2. choose a segment (from the transcript, in-bounds of the 10s fixture)
    const chosen = transcript.segments[0]!;
    const start = Math.max(0, chosen.startMs / 1000);
    const end = Math.min(9, Math.max(start + 1, chosen.endMs / 1000));

    // 3. clip the segment (canned ffmpeg)
    const clipped = await e2e.invoke("clip_by_time", {
      input: "long.mp4",
      start,
      end,
      output: "clip.mp4",
    });
    expect(clipped.ok).toBe(true);

    // 4. vertical variant (canned ffprobe reports 1080x1920 = 9:16)
    const vertical = await e2e.invoke("make_vertical", {
      input: "clip.mp4",
      output: "vertical.mp4",
    });
    expect(vertical.ok).toBe(true);

    // 5. subtitle file written from the transcript
    const srt = await e2e.invoke("subtitle_srt", {
      audio: "long.mp4",
      outputPath: "out.srt",
    });
    expect(srt.ok).toBe(true);
    expect(existsSync(join(e2e.workspaceRoot, "out.srt"))).toBe(true);
    const content = readFileSync(join(e2e.workspaceRoot, "out.srt"), "utf8");
    expect(content.trim().length).toBeGreaterThan(0);
  });
});
