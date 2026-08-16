import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transcribePlugin } from "@dsh-forge-creator/plugin-creator-transcribe";
import { normalizeSegments, detectChapters, detectLanguage } from "../src/segments.js";
import { toSrt, toVtt, toAss } from "../src/subtitle.js";
import { generateToneWav, parseWavDuration } from "../src/wav.js";
import {
  runContractSuite,
  type ExecutionResult,
  type ToolContext,
} from "@dsh-forge-creator/core";
import type { Transcript, TranscriptSegment } from "../src/types.js";

let workspaceRoot: string;

beforeAll(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "dsh-transcribe-"));
});

afterAll(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

const OK: ExecutionResult = {
  exitCode: 0,
  stdout: "{}",
  stderr: "",
  timedOut: false,
  aborted: false,
  truncated: false,
  durationMs: 1,
};

const ctx = (): ToolContext => ({
  workspaceRoot,
  run: async () => OK,
  permission: { approved: true },
});

const tool = (name: string) =>
  transcribePlugin.tools.find((t) => t.name === name)!;

const SEGMENTS: TranscriptSegment[] = [
  { id: 0, startMs: 0, endMs: 1200, text: "大家好" },
  { id: 1, startMs: 1400, endMs: 3000, text: "欢迎收看本期 AI 科普" },
  { id: 2, startMs: 3200, endMs: 4500, text: "今天我们聊聊大模型" },
];

function parseSrtCues(srt: string): { start: string; end: string; text: string }[] {
  const cues: { start: string; end: string; text: string }[] = [];
  for (const block of srt.trim().split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const m = lines[1]?.match(
      /^(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})$/,
    );
    if (m) cues.push({ start: m[1], end: m[2], text: lines.slice(2).join(" ") });
  }
  return cues;
}

describe("timestamp validation (CREATOR-006)", () => {
  it("rejects non-monotonic timestamps", () => {
    const bad: TranscriptSegment[] = [
      { id: 0, startMs: 5000, endMs: 6000, text: "later" },
      { id: 1, startMs: 1000, endMs: 2000, text: "earlier" },
    ];
    const r = normalizeSegments(bad);
    expect(r.ok).toBe(false);
  });

  it("rejects segments where end < start", () => {
    const bad: TranscriptSegment[] = [
      { id: 0, startMs: 2000, endMs: 1000, text: "x" },
    ];
    expect(normalizeSegments(bad).ok).toBe(false);
  });

  it("accepts well-formed monotonic segments", () => {
    const good: TranscriptSegment[] = [
      { id: 0, startMs: 0, endMs: 1000, text: "a" },
      { id: 1, startMs: 1000, endMs: 2000, text: "b" },
    ];
    expect(normalizeSegments(good).ok).toBe(true);
  });
});

describe("subtitle rendering (CREATOR-006)", () => {
  it("produces valid SRT cue timestamps", () => {
    const srt = toSrt(SEGMENTS);
    const cues = parseSrtCues(srt);
    expect(cues.length).toBe(SEGMENTS.length);
    for (const cue of cues) {
      expect(cue.start).toMatch(/^\d{2}:\d{2}:\d{2},\d{3}$/);
      expect(cue.end).toMatch(/^\d{2}:\d{2}:\d{2},\d{3}$/);
    }
  });

  it("produces a valid VTT header", () => {
    const vtt = toVtt(SEGMENTS);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
  });

  it("produces ASS dialogue events", () => {
    const ass = toAss(SEGMENTS);
    expect(ass).toContain("[Script Info]");
    expect(ass).toContain("Dialogue:");
  });
});

describe("audio flow (CREATOR-006)", () => {
  it("rejects empty audio with a typed error", async () => {
    writeFileSync(join(workspaceRoot, "empty.wav"), Buffer.alloc(0));
    const res = await tool("transcribe_media").execute(
      { audio: "empty.wav" },
      ctx(),
    );
    expect(res.ok).toBe(false);
  });

  it("rejects over-long audio via the duration guard", async () => {
    writeFileSync(join(workspaceRoot, "long.wav"), generateToneWav(5, 4000));
    const res = await tool("transcribe_media").execute(
      { audio: "long.wav", maxDurationSeconds: 2 },
      ctx(),
    );
    expect(res.ok).toBe(false);
  });

  it("returns a structured transcript for the mock provider", async () => {
    writeFileSync(join(workspaceRoot, "sample.wav"), generateToneWav(0.2, 8000));
    const res = await tool("transcribe_media").execute(
      { audio: "sample.wav" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const t = JSON.parse(res.raw!) as Transcript;
    expect(t.segments.length).toBeGreaterThan(0);
    expect(normalizeSegments(t.segments).ok).toBe(true);
  });

  it("rejects subtitle output outside the workspace", async () => {
    writeFileSync(join(workspaceRoot, "sample.wav"), generateToneWav(0.2, 8000));
    const res = await tool("subtitle_srt").execute(
      { audio: "sample.wav", outputPath: "../out.srt" },
      ctx(),
    );
    expect(res.ok).toBe(false);
  });

  it("returns an install hint (not a stack trace) when whisper is unavailable", async () => {
    const missingCtx: ToolContext = {
      workspaceRoot,
      run: async () => ({
        exitCode: null,
        stdout: "",
        stderr: "",
        timedOut: false,
        aborted: false,
        truncated: false,
        durationMs: 0,
        error: { code: "BinaryNotFound", message: "whisper not found" },
      }),
      permission: { approved: true },
    };
    const res = await tool("transcribe_media").execute(
      { audio: "sample.wav", provider: "whisper" },
      missingCtx,
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("BinaryNotFound");
    expect(res.error?.message.toLowerCase()).toContain("install");
  });

  it("E2E: transcribe -> SRT -> valid timestamps", async () => {
    writeFileSync(join(workspaceRoot, "e2e.wav"), generateToneWav(0.2, 8000));
    const res = await tool("subtitle_srt").execute(
      { audio: "e2e.wav", outputPath: "e2e.srt" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const srt = readFileSync(join(workspaceRoot, "e2e.srt"), "utf8");
    const cues = parseSrtCues(srt);
    expect(cues.length).toBeGreaterThan(0);
    for (const c of cues) {
      expect(c.start).toMatch(/^\d{2}:\d{2}:\d{2},\d{3}$/);
    }
  });
});

describe("contract suite (CREATOR-006)", () => {
  it("passes the shared plugin contract kit", async () => {
    const report = await runContractSuite(transcribePlugin, {
      workspaceRoot,
      missingBinaryTool: "transcribe_media",
      missingBinaryToolArgs: { audio: "clip.wav", provider: "whisper" },
      runner: async () => OK,
      toolArgs: {
        transcribe_media: { valid: { audio: "clip.wav" }, invalid: {} },
        transcribe_segments: { valid: { audio: "clip.wav" }, invalid: {} },
        transcribe_words: { valid: { audio: "clip.wav" }, invalid: {} },
        subtitle_srt: {
          valid: { audio: "clip.wav", outputPath: "out.srt" },
          invalid: {},
        },
        subtitle_vtt: {
          valid: { audio: "clip.wav", outputPath: "out.vtt" },
          invalid: {},
        },
        subtitle_ass: {
          valid: { audio: "clip.wav", outputPath: "out.ass" },
          invalid: {},
        },
        chapter_detect: { valid: { audio: "clip.wav" }, invalid: {} },
        language_detect: { valid: { audio: "clip.wav" }, invalid: {} },
        transcript_export: {
          valid: { audio: "clip.wav", outputPath: "out.txt" },
          invalid: {},
        },
      },
    });
    if (!report.passed) {
      const failed = report.checks.filter((c) => !c.passed);
      expect(
        report.passed,
        "failed checks:\n" +
          failed.map((c) => `- ${c.name} :: ${c.detail ?? ""}`).join("\n"),
      ).toBe(true);
    } else {
      expect(report.passed).toBe(true);
    }
  });
});
