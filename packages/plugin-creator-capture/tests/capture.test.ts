import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { capturePlugin } from "@dsh-forge-creator/plugin-creator-capture";
import { buildDownloadArgv, buildPlaylistArgv } from "../src/argv.js";
import {
  runContractSuite,
  assertRightsPolicy,
  assertNoBypassFlags,
  assertCreatorAssetInWorkspace,
  assertWithinResourceLimits,
  type ExecutionResult,
  type ToolContext,
  type CreatorAsset,
} from "@dsh-forge-creator/core";

let workspaceRoot: string;

beforeAll(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "dsh-capture-"));
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
  capturePlugin.tools.find((t) => t.name === name)!;

describe("argv builders (CREATOR-005)", () => {
  it("returns a typed string[] argv (never a shell string)", () => {
    const res = buildDownloadArgv({
      sourceUrl: "https://example.invalid/v",
      outputPath: join(workspaceRoot, "out.mp4"),
      kind: "media",
      conflict: "fail",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Array.isArray(res.argv)).toBe(true);
      expect(res.argv.every((a) => typeof a === "string")).toBe(true);
    }
  });

  it("encodes the explicit conflict policy", () => {
    const fail = buildDownloadArgv({
      sourceUrl: "u",
      outputPath: "o",
      kind: "media",
      conflict: "fail",
    });
    const overwrite = buildDownloadArgv({
      sourceUrl: "u",
      outputPath: "o",
      kind: "media",
      conflict: "overwrite-approved",
    });
    expect(fail.ok).toBe(true);
    expect(overwrite.ok).toBe(true);
    if (fail.ok && overwrite.ok) {
      expect(fail.argv).toContain("--no-overwrites");
      expect(overwrite.argv).toContain("--force-overwrites");
    }
  });

  it("never appends arbitrary extra args to the argv", () => {
    const spec = {
      sourceUrl: "u",
      outputPath: "o",
      kind: "media",
      conflict: "fail",
      extraArgs: ["--exec", "rm -rf /"],
    } as unknown as Parameters<typeof buildDownloadArgv>[0];
    const res = buildDownloadArgv(spec);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.argv.join(" ")).not.toContain("--exec");
      expect(res.argv.join(" ")).not.toContain("rm -rf");
    }
  });

  it("rejects an unknown download kind", () => {
    const res = buildDownloadArgv({
      sourceUrl: "u",
      outputPath: "o",
      kind: "banana" as never,
      conflict: "fail",
    });
    expect(res.ok).toBe(false);
  });

  it("bounds playlist argv with a limit", () => {
    const argv = buildPlaylistArgv("https://example.invalid/p", "dir", 5, false);
    expect(argv.join(" ")).toContain("1-5");
  });
});

describe("guards (CREATOR-005)", () => {
  it("rejects an output path that escapes the workspace", () => {
    expect(() =>
      assertCreatorAssetInWorkspace(
        { path: "../escape.mp4" } as CreatorAsset,
        workspaceRoot,
      ),
    ).toThrow();
  });

  it("rejects strict rights with unknown status", () => {
    expect(() => assertRightsPolicy({ status: "unknown" }, "strict")).toThrow();
  });

  it("rejects DRM/captcha bypass flags", () => {
    expect(() => assertNoBypassFlags({ drmBypass: true })).toThrow();
  });

  it("rejects a playlist over the batch limit", () => {
    expect(() =>
      assertWithinResourceLimits({ batchItems: 5001 }),
    ).toThrow();
  });
});

describe("download flow (CREATOR-005)", () => {
  it("returns a dry-run argv + asset for a confirmed-rights download", async () => {
    const res = await tool("media_download").execute(
      {
        sourceUrl: "https://example.invalid/v",
        outputPath: "out.mp4",
        rights: { status: "owned" },
        conflict: "fail",
        dryRun: true,
      },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const payload = JSON.parse(res.raw!) as {
      argv: string[];
      asset: CreatorAsset;
    };
    expect(Array.isArray(payload.argv)).toBe(true);
    expect(payload.asset.rights?.status).toBe("owned");
    expect(payload.asset.source).toBe("https://example.invalid/v");
  });
});

describe("contract suite (CREATOR-005)", () => {
  it("passes the shared plugin contract kit", async () => {
    const report = await runContractSuite(capturePlugin, {
      workspaceRoot,
      missingBinaryTool: "media_inspect",
      missingBinaryToolArgs: { sourceUrl: "https://example.invalid/v" },
      runner: async () => OK,
      toolArgs: {
        media_inspect: {
          valid: { sourceUrl: "https://example.invalid/v" },
          invalid: {},
        },
        media_formats: {
          valid: { sourceUrl: "https://example.invalid/v" },
          invalid: {},
        },
        media_download: {
          valid: {
            sourceUrl: "u",
            outputPath: "out.mp4",
            rights: { status: "owned" },
            conflict: "fail",
          },
          invalid: { sourceUrl: "u" },
        },
        audio_download: {
          valid: {
            sourceUrl: "u",
            outputPath: "out.mp3",
            rights: { status: "owned" },
            conflict: "fail",
          },
          invalid: {},
        },
        subtitle_download: {
          valid: {
            sourceUrl: "u",
            outputPath: "sub.srt",
            rights: { status: "owned" },
            conflict: "fail",
          },
          invalid: {},
        },
        thumbnail_download: {
          valid: {
            sourceUrl: "u",
            outputPath: "thumb.jpg",
            rights: { status: "owned" },
            conflict: "fail",
          },
          invalid: {},
        },
        playlist_inspect: {
          valid: { sourceUrl: "https://example.invalid/p" },
          invalid: {},
        },
        playlist_download: {
          valid: {
            sourceUrl: "https://example.invalid/p",
            outputDir: "playlist",
            rights: { status: "owned" },
            conflict: "fail",
          },
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
