import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localizePlugin } from "@dsh-forge-creator/plugin-creator-localize";
import {
  runContractSuite,
  type ToolContext,
} from "@dsh-forge-creator/core";
import { parseSrt } from "../src/srt.js";

let workspaceRoot: string;

const SRT = `1
00:00:00,000 --> 00:00:01,000
Hello world

2
00:00:01,500 --> 00:00:03,000
This is a test subtitle
`;

beforeAll(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "dsh-localize-"));
  writeFileSync(join(workspaceRoot, "source.srt"), SRT, "utf8");
  writeFileSync(join(workspaceRoot, "source.vtt"), "WEBVTT\n", "utf8");
});

afterAll(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

const ctx = (approved = true): ToolContext => ({
  workspaceRoot,
  run: async () => {
    throw new Error("no binary expected for creator-localize");
  },
  permission: approved ? { approved: true } : undefined,
});

const tool = (name: string) =>
  localizePlugin.tools.find((t) => t.name === name)!;

function cueTimes(srt: string): Array<{ start: number; end: number }> {
  const parsed = parseSrt(srt);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.cues.map((c) => ({ start: c.startMs, end: c.endMs }));
}

describe("subtitle_translate (CREATOR-011)", () => {
  it("translates subtitles and preserves valid timestamps", async () => {
    const res = await tool("subtitle_translate").execute(
      {
        inputPath: "source.srt",
        sourceLanguage: "en",
        targetLanguage: "zh",
        outputPath: "zh.srt",
        provider: "mock",
      },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const out = readFileSync(join(workspaceRoot, "zh.srt"), "utf8");
    const cues = parseSrt(out);
    expect(cues.ok).toBe(true);
    if (cues.ok) {
      expect(cues.cues[0]!.text).toContain("[zh]");
      expect(cueTimes(out)).toEqual(cueTimes(SRT));
    }
  });

  it("makes the same source/target language policy explicit (rejects)", async () => {
    const res = await tool("subtitle_translate").execute(
      {
        inputPath: "source.srt",
        sourceLanguage: "zh",
        targetLanguage: "zh",
        outputPath: "zh2.srt",
        provider: "mock",
      },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
    expect(res.error?.message).toMatch(/same|differ/i);
  });

  it("controls output collisions (refuses to overwrite without overwrite=true)", async () => {
    writeFileSync(join(workspaceRoot, "existing.srt"), "existing", "utf8");
    const res = await tool("subtitle_translate").execute(
      {
        inputPath: "source.srt",
        sourceLanguage: "en",
        targetLanguage: "fr",
        outputPath: "existing.srt",
        provider: "mock",
      },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.message).toMatch(/exist|overwrite/i);
  });

  it("returns an explicit diagnostic for an unavailable provider", async () => {
    const res = await tool("subtitle_translate").execute(
      {
        inputPath: "source.srt",
        sourceLanguage: "en",
        targetLanguage: "fr",
        outputPath: "fr.srt",
        provider: "videolingo",
      },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("ToolFailure");
    expect(res.error?.message.toLowerCase()).toContain("not configured");
  });

  it("rejects an input/output outside the workspace", async () => {
    const res = await tool("subtitle_translate").execute(
      {
        inputPath: "../source.srt",
        sourceLanguage: "en",
        targetLanguage: "fr",
        outputPath: "fr.srt",
        provider: "mock",
      },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("WorkspaceViolation");
  });
});

describe("subtitle_align (CREATOR-011)", () => {
  it("shifts cues by an offset", async () => {
    const res = await tool("subtitle_align").execute(
      { inputPath: "source.srt", offsetMs: 1000, outputPath: "aligned.srt" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const out = readFileSync(join(workspaceRoot, "aligned.srt"), "utf8");
    const times = cueTimes(out);
    expect(times[0]).toEqual({ start: 1000, end: 2000 });
  });

  it("rejects alignment that would produce negative time", async () => {
    const res = await tool("subtitle_align").execute(
      { inputPath: "source.srt", offsetMs: -500, outputPath: "neg.srt" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
    expect(res.error?.message).toMatch(/negative/i);
  });
});

describe("subtitle_resegment (CREATOR-011)", () => {
  it("splits long cues within maxDurationMs", async () => {
    const res = await tool("subtitle_resegment").execute(
      { inputPath: "source.srt", maxDurationMs: 1000, outputPath: "reseg.srt" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const out = readFileSync(join(workspaceRoot, "reseg.srt"), "utf8");
    const parsed = parseSrt(out);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      for (const cue of parsed.cues) {
        expect(cue.endMs - cue.startMs).toBeLessThanOrEqual(1000);
      }
    }
  });
});

describe("dub_video (CREATOR-011)", () => {
  it("requires an authorized voice reference (voice policy)", async () => {
    const res = await tool("dub_video").execute(
      { referenceId: "Nobody", targetLanguage: "fr", outputPath: "dub.m4a", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.message).toMatch(/authoriz/i);
  });

  it("dubs with an authorized reference", async () => {
    const res = await tool("dub_video").execute(
      { referenceId: "voice-1", targetLanguage: "fr", outputPath: "dub2.m4a", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
  });
});

describe("localize_video / localize_preview (CREATOR-011)", () => {
  it("localizes a video (translate + asset path)", async () => {
    const res = await tool("localize_video").execute(
      {
        subtitlePath: "source.srt",
        sourceLanguage: "en",
        targetLanguage: "zh",
        outputDir: "localized",
        provider: "mock",
      },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const r = JSON.parse(res.raw!) as { outputPath: string };
    expect(r.outputPath).not.toMatch(/^https?:\/\//);
  });

  it("preview returns a local descriptor (no external URL)", async () => {
    const res = await tool("localize_preview").execute(
      { subtitlePath: "source.srt", targetLanguage: "zh", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    expect(res.raw).not.toMatch(/https?:\/\//);
  });
});

describe("contract suite (CREATOR-011)", () => {
  it("passes the shared plugin contract kit", async () => {
    const report = await runContractSuite(localizePlugin, {
      workspaceRoot,
      toolArgs: {
        subtitle_translate: {
          valid: {
            inputPath: "source.srt",
            sourceLanguage: "en",
            targetLanguage: "fr",
            outputPath: "tr.srt",
            provider: "mock",
          },
          invalid: { inputPath: 42 },
        },
        subtitle_align: {
          valid: { inputPath: "source.srt", offsetMs: 100, outputPath: "al.srt" },
          invalid: { offsetMs: "x" },
        },
        subtitle_resegment: {
          valid: { inputPath: "source.srt", maxDurationMs: 1000, outputPath: "rs.srt" },
          invalid: { maxDurationMs: "x" },
        },
        localize_video: {
          valid: {
            subtitlePath: "source.srt",
            sourceLanguage: "en",
            targetLanguage: "zh",
            outputDir: "loc",
            provider: "mock",
          },
          invalid: { sourceLanguage: 42 },
        },
        dub_video: {
          valid: { referenceId: "voice-1", targetLanguage: "fr", outputPath: "d.m4a", provider: "mock" },
          invalid: {},
        },
        localize_preview: {
          valid: { subtitlePath: "source.srt", targetLanguage: "zh", provider: "mock" },
          invalid: { subtitlePath: 42 },
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
