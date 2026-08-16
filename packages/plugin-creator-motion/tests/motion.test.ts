import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { motionPlugin } from "@dsh-forge-creator/plugin-creator-motion";
import {
  runContractSuite,
  type ToolContext,
} from "@dsh-forge-creator/core";
import type { MotionTemplate } from "../src/templates.js";

let workspaceRoot: string;

beforeAll(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "dsh-motion-"));
  writeFileSync(join(workspaceRoot, "bg.png"), "placeholder");
  mkdirSync(join(workspaceRoot, "out"), { recursive: true });
});

afterAll(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

const ctx = (approved = true): ToolContext => ({
  workspaceRoot,
  run: async () => {
    throw new Error("no binary expected for creator-motion");
  },
  permission: approved ? { approved: true } : undefined,
});

const tool = (name: string) =>
  motionPlugin.tools.find((t) => t.name === name)!;

const introInput = { title: "Hello World", subtitle: "Episode 1" };

describe("motion_templates / motion_inspect_template (CREATOR-012)", () => {
  it("lists templates with metadata", async () => {
    const res = await tool("motion_templates").execute({}, ctx());
    expect(res.ok).toBe(true);
    const templates = JSON.parse(res.raw!) as MotionTemplate[];
    expect(templates.length).toBeGreaterThan(0);
    const intro = templates.find((t) => t.id === "intro-card");
    expect(intro?.aspectRatios).toContain("9:16");
    expect(typeof intro?.estimatedDuration).toBe("number");
    expect(intro?.engine).toBe("mock");
  });

  it("inspects a template and exposes its input schema", async () => {
    const res = await tool("motion_inspect_template").execute(
      { template: "intro-card" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const t = JSON.parse(res.raw!) as MotionTemplate;
    expect(t.inputSchema.some((f) => f.name === "title" && f.required)).toBe(true);
  });

  it("rejects an unknown template", async () => {
    const res = await tool("motion_inspect_template").execute(
      { template: "nope" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
  });
});

describe("motion_render (CREATOR-012)", () => {
  it("renders a template with the mock renderer", async () => {
    const res = await tool("motion_render").execute(
      { template: "intro-card", input: introInput, outputPath: "out/intro.mp4", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const r = JSON.parse(res.raw!) as { width: number; height: number; aspectRatio: string };
    expect(r.aspectRatio).toBe("16:9");
    expect(r.width).toBe(1920);
    expect(r.height).toBe(1080);
  });

  it("validates template input schema (missing required field)", async () => {
    const res = await tool("motion_render").execute(
      { template: "intro-card", input: {}, outputPath: "out/x.mp4", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
    expect(res.error?.message).toMatch(/requires input field/i);
  });

  it("rejects an unknown template", async () => {
    const res = await tool("motion_render").execute(
      { template: "nope", input: {}, outputPath: "out/x.mp4", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
  });

  it("validates the aspect ratio against the template", async () => {
    const res = await tool("motion_render").execute(
      { template: "lower-thirds", input: { name: "A" }, aspectRatio: "4:5", outputPath: "out/x.mp4", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
    expect(res.error?.message).toMatch(/aspect/i);
  });

  it("returns a render timeout when the budget is below the template duration", async () => {
    const res = await tool("motion_render").execute(
      { template: "lower-thirds", input: { name: "A" }, timeoutMs: 500, outputPath: "out/x.mp4", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("Timeout");
  });

  it("rejects an output outside the workspace", async () => {
    const res = await tool("motion_render").execute(
      { template: "intro-card", input: introInput, outputPath: "../x.mp4", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("WorkspaceViolation");
  });

  it("returns a typed diagnostic for an unconfigured Remotion provider", async () => {
    const res = await tool("motion_render").execute(
      { template: "intro-card", input: introInput, outputPath: "out/x.mp4", provider: "remotion" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("ToolFailure");
    expect(res.error?.message.toLowerCase()).toContain("not configured");
  });
});

describe("motion_render_variants (CREATOR-012)", () => {
  it("renders multi-aspect-ratio variants with metadata (acceptance)", async () => {
    const res = await tool("motion_render_variants").execute(
      { template: "intro-card", input: introInput, outputDir: "out", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const assets = JSON.parse(res.raw!) as Array<{ path: string; aspectRatio: string; width: number; height: number }>;
    // intro-card supports 16:9, 9:16, 1:1 -> 3 variants with distinct paths.
    expect(assets.length).toBe(3);
    const paths = new Set(assets.map((a) => a.path));
    expect(paths.size).toBe(3);
    for (const a of assets) {
      expect(a.path).not.toMatch(/^https?:\/\//);
      expect(a.width / a.height).toBeCloseTo(
        Number(a.aspectRatio.split(":")[0]) / Number(a.aspectRatio.split(":")[1]),
        2,
      );
    }
  });

  it("rejects a variant naming collision (duplicate aspect ratios)", async () => {
    const res = await tool("motion_render_variants").execute(
      {
        template: "intro-card",
        input: introInput,
        outputDir: "out",
        aspectRatios: ["16:9", "16:9"],
        provider: "mock",
      },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
    expect(res.error?.message).toMatch(/collision/i);
  });
});

describe("motion_preview (CREATOR-012)", () => {
  it("returns a local preview descriptor (no external URL)", async () => {
    const res = await tool("motion_preview").execute(
      { template: "intro-card", input: introInput, aspectRatio: "9:16" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    expect(res.raw).not.toMatch(/https?:\/\//);
  });
});

describe("contract suite (CREATOR-012)", () => {
  it("passes the shared plugin contract kit", async () => {
    const report = await runContractSuite(motionPlugin, {
      workspaceRoot,
      toolArgs: {
        motion_templates: {
          valid: {},
          invalid: { foo: 1 },
        },
        motion_inspect_template: {
          valid: { template: "intro-card" },
          invalid: { template: 42 },
        },
        motion_render: {
          valid: { template: "intro-card", input: introInput, outputPath: "out/r.mp4", provider: "mock" },
          invalid: { template: 42 },
        },
        motion_render_variants: {
          valid: { template: "intro-card", input: introInput, outputDir: "out", provider: "mock" },
          invalid: { template: 42 },
        },
        motion_preview: {
          valid: { template: "intro-card", input: introInput },
          invalid: { template: 42 },
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
