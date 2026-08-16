import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { creatorClipsPlugin } from "@dsh-forge-creator/plugin-creator-clips";
import {
  runContractSuite,
  type ExecutionResult,
  type ExecutionRunner,
  type ToolContext,
} from "@dsh-forge-creator/core";

let workspaceRoot: string;

beforeAll(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "dsh-clips-"));
  writeFileSync(join(workspaceRoot, "source.mp4"), "placeholder");
  writeFileSync(join(workspaceRoot, "source2.mp4"), "placeholder");
  writeFileSync(join(workspaceRoot, "audio.wav"), "placeholder");
});

afterAll(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

const OK = {
  timedOut: false,
  aborted: false,
  truncated: false,
  durationMs: 1,
};

const PROBE_JSON = JSON.stringify({
  format: { format_name: "mp4", duration: "10.000000", size: "1000" },
  streams: [{ index: 0, codec_type: "video", codec_name: "h264", width: 1920, height: 1080 }],
});

const FFMPEG_OUTPUT =
  "frame= 10 fps=0.0 q=-0.0 size=N/A time=00:00:03.00 bitrate=N/A speed= 1x";

/** ffprobe -> PROBE_JSON (10s); ffmpeg -> success. */
function mockRunner(
  opts: { probe?: ExecutionResult; ffprobe?: ExecutionResult } = {},
): ExecutionRunner {
  return async (req) => {
    const key = req.binary.toLowerCase();
    if (key.includes("ffprobe")) return opts.ffprobe ?? opts.probe ?? { exitCode: 0, stdout: PROBE_JSON, stderr: "", ...OK };
    return { exitCode: 0, stdout: FFMPEG_OUTPUT, stderr: "", ...OK };
  };
}

/** Capture the ffmpeg argv passed to ctx.run (for the no-shell-injection check). */
function captureClipArgs(): { runner: ExecutionRunner; args: () => string[] } {
  let captured: string[] = [];
  const runner: ExecutionRunner = async (req) => {
    if (req.binary.toLowerCase().includes("ffprobe")) {
      return { exitCode: 0, stdout: PROBE_JSON, stderr: "", ...OK };
    }
    captured = [...req.args];
    return { exitCode: 0, stdout: FFMPEG_OUTPUT, stderr: "", ...OK };
  };
  return { runner, args: () => captured };
}

const ctx = (runner: ExecutionRunner): ToolContext => ({
  workspaceRoot,
  run: runner,
  permission: { approved: true },
});

const tool = (name: string) =>
  creatorClipsPlugin.tools.find((t) => t.name === name)!;

describe("clip_by_time (CREATOR-007)", () => {
  it("clips a 2s-5s range and delegates duration to the ffmpeg adapter", async () => {
    const { runner, args } = captureClipArgs();
    const res = await tool("clip_by_time").execute(
      { input: "source.mp4", start: 2, end: 5, output: "clip.mp4" },
      ctx(runner),
    );
    expect(res.ok).toBe(true);
    expect(args()).toContain("-ss");
    expect(args()).toContain("2");
    expect(args()).toContain("-t");
    expect(args()).toContain("3");
  });

  it("rejects an invalid time range (negative start)", async () => {
    const res = await tool("clip_by_time").execute(
      { input: "source.mp4", start: -1, end: 5, output: "clip.mp4" },
      ctx(mockRunner()),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
  });

  it("rejects start >= end", async () => {
    const a = await tool("clip_by_time").execute(
      { input: "source.mp4", start: 5, end: 5, output: "a.mp4" },
      ctx(mockRunner()),
    );
    const b = await tool("clip_by_time").execute(
      { input: "source.mp4", start: 6, end: 3, output: "b.mp4" },
      ctx(mockRunner()),
    );
    expect(a.error?.code).toBe("InvalidArguments");
    expect(b.error?.code).toBe("InvalidArguments");
  });

  it("rejects a segment outside the media duration", async () => {
    // mock media duration is 10s; end=12 exceeds it.
    const res = await tool("clip_by_time").execute(
      { input: "source.mp4", start: 2, end: 12, output: "clip.mp4" },
      ctx(mockRunner()),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
    expect(res.error?.message).toMatch(/duration/i);
  });

  it("accepts mm:ss timestamp strings", async () => {
    const { runner, args } = captureClipArgs();
    const res = await tool("clip_by_time").execute(
      { input: "source.mp4", start: "0:02", end: "0:05", output: "clip.mp4" },
      ctx(runner),
    );
    expect(res.ok).toBe(true);
    expect(args()).toContain("2");
    expect(args()).toContain("3");
  });

  it("generates a typed argv with no shell injection", async () => {
    const { runner, args } = captureClipArgs();
    const res = await tool("clip_by_time").execute(
      { input: "source.mp4", start: 2, end: 5, output: "clip.mp4" },
      ctx(runner),
    );
    expect(res.ok).toBe(true);
    const argv = args();
    expect(Array.isArray(argv)).toBe(true);
    // No shell metacharacters may reach the child process.
    for (const a of argv) {
      expect(a).not.toMatch(/[;&|`$]/);
    }
  });

  it("surfaces PermissionDenied when approval is missing", async () => {
    const res = await tool("clip_by_time").execute(
      { input: "source.mp4", start: 2, end: 5, output: "clip.mp4" },
      { workspaceRoot, run: mockRunner(), permission: { approved: false } },
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("PermissionDenied");
  });
});

describe("clip_by_chapter / clip_by_transcript (CREATOR-007)", () => {
  it("clip_by_chapter clips to a named chapter range", async () => {
    const { runner, args } = captureClipArgs();
    const res = await tool("clip_by_chapter").execute(
      {
        input: "source.mp4",
        chapter: { name: "intro", start: 1, end: 4 },
        output: "chapter.mp4",
      },
      ctx(runner),
    );
    expect(res.ok).toBe(true);
    expect(args()).toContain("-ss");
    expect(args()).toContain("1");
  });

  it("clip_by_chapter rejects an invalid chapter range", async () => {
    const res = await tool("clip_by_chapter").execute(
      {
        input: "source.mp4",
        chapter: { name: "bad", start: 4, end: 1 },
        output: "chapter.mp4",
      },
      ctx(mockRunner()),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
  });

  it("clip_by_transcript clips to a transcript segment range", async () => {
    const { runner, args } = captureClipArgs();
    const res = await tool("clip_by_transcript").execute(
      {
        input: "source.mp4",
        segment: { start: 3, end: 6, text: "hello" },
        output: "seg.mp4",
      },
      ctx(runner),
    );
    expect(res.ok).toBe(true);
    expect(args()).toContain("3");
    expect(args()).toContain("3"); // duration 6-3
  });

  it("clip_by_transcript rejects a segment outside the duration", async () => {
    const res = await tool("clip_by_transcript").execute(
      {
        input: "source.mp4",
        segment: { start: 8, end: 15 },
        output: "seg.mp4",
      },
      ctx(mockRunner()),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
  });
});

describe("remove_silence / make_vertical / make_square (CREATOR-007)", () => {
  it("remove_silence delegates to the adapter silence tool", async () => {
    const { runner, args } = captureClipArgs();
    const res = await tool("remove_silence").execute(
      { input: "audio.wav", output: "clean.wav" },
      ctx(runner),
    );
    expect(res.ok).toBe(true);
    expect(args()).toContain("-af");
    // The filter is a single argv element (exact match, not substring).
    expect(args().some((a) => a.startsWith("silenceremove="))).toBe(true);
  });

  it("make_vertical delegates to the adapter vertical tool and verifies 9:16", async () => {
    const runner = mockRunner({
      ffprobe: {
        exitCode: 0,
        stdout: JSON.stringify({ streams: [{ width: 1080, height: 1920 }] }),
        stderr: "",
        ...OK,
      },
    });
    const res = await tool("make_vertical").execute(
      { input: "source.mp4", output: "v.mp4" },
      ctx(runner),
    );
    expect(res.ok).toBe(true);
  });

  it("make_vertical fails when the output is not 9:16", async () => {
    const runner = mockRunner({
      ffprobe: {
        exitCode: 0,
        stdout: JSON.stringify({ streams: [{ width: 1920, height: 1080 }] }),
        stderr: "",
        ...OK,
      },
    });
    const res = await tool("make_vertical").execute(
      { input: "source.mp4", output: "v.mp4" },
      ctx(runner),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("ToolFailure");
    expect(res.error?.message).toMatch(/ratio|aspect/i);
  });

  it("make_square delegates to the adapter square tool and verifies 1:1", async () => {
    const runner = mockRunner({
      ffprobe: {
        exitCode: 0,
        stdout: JSON.stringify({ streams: [{ width: 1080, height: 1080 }] }),
        stderr: "",
        ...OK,
      },
    });
    const res = await tool("make_square").execute(
      { input: "source.mp4", output: "s.mp4" },
      ctx(runner),
    );
    expect(res.ok).toBe(true);
  });
});

describe("batch_clip / merge_segments (CREATOR-007)", () => {
  it("batch_clip clips multiple segments", async () => {
    const res = await tool("batch_clip").execute(
      {
        clips: [
          { input: "source.mp4", start: 0, end: 2, output: "a.mp4" },
          { input: "source.mp4", start: 3, end: 5, output: "b.mp4" },
        ],
      },
      ctx(mockRunner()),
    );
    expect(res.ok).toBe(true);
  });

  it("batch_clip rejects an output collision", async () => {
    const res = await tool("batch_clip").execute(
      {
        clips: [
          { input: "source.mp4", start: 0, end: 2, output: "a.mp4" },
          { input: "source.mp4", start: 3, end: 5, output: "a.mp4" },
        ],
      },
      ctx(mockRunner()),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
    expect(res.error?.message).toMatch(/collision/i);
  });

  it("batch_clip rejects a clip with an invalid range", async () => {
    const res = await tool("batch_clip").execute(
      {
        clips: [
          { input: "source.mp4", start: 5, end: 2, output: "a.mp4" },
        ],
      },
      ctx(mockRunner()),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
  });

  it("merge_segments delegates to the adapter concat tool", async () => {
    const { runner, args } = captureClipArgs();
    const res = await tool("merge_segments").execute(
      { inputs: ["source.mp4", "source2.mp4"], output: "merged.mp4" },
      ctx(runner),
    );
    expect(res.ok).toBe(true);
    expect(args()).toContain("-f");
    expect(args()).toContain("concat");
  });

  it("merge_segments rejects an empty inputs array", async () => {
    const res = await tool("merge_segments").execute(
      { inputs: [], output: "merged.mp4" },
      ctx(mockRunner()),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
  });
});

describe("contract suite (CREATOR-007)", () => {
  it("passes the shared plugin contract kit", async () => {
    const routing: ExecutionRunner = async (req) => {
      if (req.binary.toLowerCase().includes("ffprobe")) {
        if (req.args.includes("stream=width,height")) {
          return {
            exitCode: 0,
            stdout: JSON.stringify({ streams: [{ width: 1080, height: 1920 }] }),
            stderr: "",
            ...OK,
          };
        }
        return { exitCode: 0, stdout: PROBE_JSON, stderr: "", ...OK };
      }
      return { exitCode: 0, stdout: FFMPEG_OUTPUT, stderr: "", ...OK };
    };
    const report = await runContractSuite(creatorClipsPlugin, {
      workspaceRoot,
      runner: routing,
      // make_vertical expects 9:16, make_square expects 1:1 — each needs its
      // own probed output dimensions.
      runnerByTool: {
        make_vertical: async (req) => {
          if (req.binary.toLowerCase().includes("ffprobe")) {
            return {
              exitCode: 0,
              stdout: JSON.stringify({ streams: [{ width: 1080, height: 1920 }] }),
              stderr: "",
              ...OK,
            };
          }
          return { exitCode: 0, stdout: FFMPEG_OUTPUT, stderr: "", ...OK };
        },
        make_square: async (req) => {
          if (req.binary.toLowerCase().includes("ffprobe")) {
            return {
              exitCode: 0,
              stdout: JSON.stringify({ streams: [{ width: 1080, height: 1080 }] }),
              stderr: "",
              ...OK,
            };
          }
          return { exitCode: 0, stdout: FFMPEG_OUTPUT, stderr: "", ...OK };
        },
      },
      toolArgs: {
        clip_by_time: {
          valid: { input: "source.mp4", start: 2, end: 5, output: "c.mp4" },
          invalid: { input: 42 },
        },
        clip_by_chapter: {
          valid: {
            input: "source.mp4",
            chapter: { start: 1, end: 4 },
            output: "cc.mp4",
          },
          invalid: { input: 42 },
        },
        clip_by_transcript: {
          valid: {
            input: "source.mp4",
            segment: { start: 1, end: 4 },
            output: "ct.mp4",
          },
          invalid: { input: 42 },
        },
        remove_silence: {
          valid: { input: "audio.wav", output: "clean.wav" },
          invalid: { input: 42 },
        },
        make_vertical: {
          valid: { input: "source.mp4", output: "v.mp4" },
          invalid: { input: 42 },
        },
        make_square: {
          valid: { input: "source.mp4", output: "s.mp4" },
          invalid: { input: 42 },
        },
        batch_clip: {
          valid: {
            clips: [{ input: "source.mp4", start: 0, end: 1, output: "b.mp4" }],
          },
          invalid: { clips: "nope" },
        },
        merge_segments: {
          valid: { inputs: ["source.mp4"], output: "m.mp4" },
          invalid: { inputs: "nope" },
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
