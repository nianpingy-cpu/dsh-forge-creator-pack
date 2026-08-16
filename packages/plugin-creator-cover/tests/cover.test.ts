import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { coverPlugin } from "@dsh-forge-creator/plugin-creator-cover";
import {
  runContractSuite,
  type ToolContext,
} from "@dsh-forge-creator/core";
import type { LayoutResult } from "../src/layout.js";

let workspaceRoot: string;

beforeAll(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "dsh-cover-"));
  writeFileSync(join(workspaceRoot, "fixture.png"), "placeholder");
});

afterAll(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

const ctx = (approved = true): ToolContext => ({
  workspaceRoot,
  run: async () => {
    throw new Error("no binary expected for creator-cover");
  },
  permission: approved ? { approved: true } : undefined,
});

const tool = (name: string) =>
  coverPlugin.tools.find((t) => t.name === name)!;

describe("cover_layout (CREATOR-009)", () => {
  it("builds a valid layout for a profile + title", async () => {
    const res = await tool("cover_layout").execute(
      { profile: "youtube-thumbnail", title: "Top 10 AI Tools", subject: "2026" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const l = JSON.parse(res.raw!) as LayoutResult;
    expect(l.profile.width).toBe(1280);
    expect(l.titleBox?.text).toBe("Top 10 AI Tools");
    expect(l.fontFallback).toBe(false);
  });

  it("detects text overflow (title exceeds the char limit)", async () => {
    const res = await tool("cover_layout").execute(
      { profile: "bilibili-cover", title: "x".repeat(31) },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
    expect(res.error?.message).toMatch(/overflow/i);
  });

  it("detects text overflow (title does not fit the safe area)", async () => {
    const res = await tool("cover_layout").execute(
      { profile: "youtube-thumbnail", title: "T", titleFontSize: 20000 },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
    expect(res.error?.message).toMatch(/overflow|fit/i);
  });

  it("detects a safe area violation (subject escapes below the title)", async () => {
    const res = await tool("cover_layout").execute(
      { profile: "youtube-thumbnail", title: "T", subject: "S", subjectFontSize: 20000 },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
    expect(res.error?.message).toMatch(/safe area/i);
  });

  it("falls back to a supported font for an unknown font", async () => {
    const res = await tool("cover_layout").execute(
      { profile: "x-image", title: "Hello", font: "NotARealFont" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const l = JSON.parse(res.raw!) as LayoutResult;
    expect(l.fontFallback).toBe(true);
    expect(l.font).toBe("Arial");
  });

  it("rejects an unknown profile", async () => {
    const res = await tool("cover_layout").execute(
      { profile: "nope", title: "x" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
  });
});

describe("cover_generate_background (CREATOR-009)", () => {
  it("generates a mock background with recorded dimensions", async () => {
    const res = await tool("cover_generate_background").execute(
      { outputPath: "bg.png", width: 1280, height: 720, provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const r = JSON.parse(res.raw!) as { width: number; height: number; path: string };
    expect(r.width).toBe(1280);
    expect(r.height).toBe(720);
    expect(r.path).toBe("bg.png");
  });

  it("returns a typed diagnostic for an unconfigured ComfyUI provider", async () => {
    const res = await tool("cover_generate_background").execute(
      { outputPath: "bg.png", width: 1280, height: 720, provider: "comfyui" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("ToolFailure");
    expect(res.error?.message.toLowerCase()).toContain("not configured");
  });

  it("rejects an output path outside the workspace", async () => {
    const res = await tool("cover_generate_background").execute(
      { outputPath: "../bg.png", width: 1280, height: 720, provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("WorkspaceViolation");
  });

  it("denies without permission approval", async () => {
    const res = await tool("cover_generate_background").execute(
      { outputPath: "bg.png", width: 1280, height: 720, provider: "mock" },
      ctx(false),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("PermissionDenied");
  });
});

describe("cover_add_title / cover_add_subject (CREATOR-009)", () => {
  it("adds a title and records the cover", async () => {
    const res = await tool("cover_add_title").execute(
      { profile: "youtube-thumbnail", title: "Top 10", outputPath: "t.png", font: "Inter" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.raw!).path).toBe("t.png");
  });

  it("rejects a title that overflows", async () => {
    const res = await tool("cover_add_title").execute(
      { profile: "bilibili-cover", title: "x".repeat(31), outputPath: "t.png" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
    expect(res.error?.message).toMatch(/overflow/i);
  });

  it("falls back for an unsupported font without crashing", async () => {
    const res = await tool("cover_add_title").execute(
      { profile: "x-image", title: "Hi", outputPath: "t2.png", font: "Papyrus" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.raw!).fontFallback).toBe(true);
  });

  it("adds a subject and rejects overflow", async () => {
    const ok = await tool("cover_add_subject").execute(
      { profile: "x-image", subject: "A", outputPath: "s.png" },
      ctx(),
    );
    expect(ok.ok).toBe(true);
    const bad = await tool("cover_add_subject").execute(
      { profile: "bilibili-cover", subject: "x".repeat(31), outputPath: "s2.png" },
      ctx(),
    );
    expect(bad.ok).toBe(false);
    expect(bad.error?.code).toBe("InvalidArguments");
  });
});

describe("cover_resize / cover_validate (CREATOR-009)", () => {
  it("resizes to profile dimensions and validates them", async () => {
    const res = await tool("cover_resize").execute(
      { inputPath: "fixture.png", profile: "youtube-thumbnail", outputPath: "resized.png" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const dims = JSON.parse(res.raw!) as { path: string; width: number; height: number };
    expect(dims).toMatchObject({ width: 1280, height: 720 });

    const check = await tool("cover_validate").execute(
      { inputPath: "resized.png", profile: "youtube-thumbnail" },
      ctx(),
    );
    expect(check.ok).toBe(true);
  });

  it("fails dimension validation against the wrong profile", async () => {
    await tool("cover_resize").execute(
      { inputPath: "fixture.png", profile: "youtube-thumbnail", outputPath: "resized2.png" },
      ctx(),
    );
    const check = await tool("cover_validate").execute(
      { inputPath: "resized2.png", profile: "x-image" },
      ctx(),
    );
    expect(check.ok).toBe(false);
  });

  it("rejects an invalid input path", async () => {
    const res = await tool("cover_resize").execute(
      { inputPath: "../outside.png", profile: "x-image", outputPath: "o.png" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("WorkspaceViolation");
  });

  it("rejects validating an unknown image (no cover record)", async () => {
    const check = await tool("cover_validate").execute(
      { inputPath: "never-produced.png", profile: "x-image" },
      ctx(),
    );
    expect(check.ok).toBe(false);
  });
});

describe("cover_variants (CREATOR-009)", () => {
  it("generates 3 platform variants and returns CreatorAsset[] (acceptance)", async () => {
    const res = await tool("cover_variants").execute(
      {
        inputPath: "fixture.png",
        profiles: ["youtube-thumbnail", "x-image", "douyin-vertical"],
        outputDir: "covers",
      },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const assets = JSON.parse(res.raw!) as Array<{
      path: string;
      width: number;
      height: number;
      profile: string;
    }>;
    expect(assets.length).toBe(3);
    for (const a of assets) {
      expect(a.path).not.toMatch(/^https?:\/\//);
    }
    // Each variant validates against its own profile.
    for (const a of assets) {
      const check = await tool("cover_validate").execute(
        { inputPath: a.path, profile: a.profile },
        ctx(),
      );
      expect(check.ok).toBe(true);
    }
  });

  it("rejects an invalid profile id in the list", async () => {
    const res = await tool("cover_variants").execute(
      {
        inputPath: "fixture.png",
        profiles: ["youtube-thumbnail", "nope"],
        outputDir: "covers",
      },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
  });
});

describe("contract suite (CREATOR-009)", () => {
  it("passes the shared plugin contract kit", async () => {
    const report = await runContractSuite(coverPlugin, {
      workspaceRoot,
      toolArgs: {
        cover_generate_background: {
          valid: { outputPath: "bg.png", width: 100, height: 100, provider: "mock" },
          invalid: { outputPath: 42 },
        },
        cover_layout: {
          valid: { profile: "x-image", title: "Hi" },
          invalid: { profile: 42 },
        },
        cover_add_title: {
          valid: { profile: "x-image", title: "Hi", outputPath: "t.png" },
          invalid: { title: 42 },
        },
        cover_add_subject: {
          valid: { profile: "x-image", subject: "Hi", outputPath: "s.png" },
          invalid: { subject: 42 },
        },
        cover_resize: {
          valid: { inputPath: "fixture.png", profile: "x-image", outputPath: "r.png" },
          invalid: { inputPath: 42 },
        },
        cover_variants: {
          valid: { inputPath: "fixture.png", profiles: ["x-image"], outputDir: "c" },
          invalid: { profiles: "nope" },
        },
        cover_validate: {
          valid: { inputPath: "fixture.png", profile: "x-image" },
          invalid: { profile: 42 },
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
