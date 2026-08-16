import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shortVideoPlugin } from "@dsh-forge-creator/plugin-creator-short-video";
import {
  runContractSuite,
  type ToolContext,
} from "@dsh-forge-creator/core";
import type {
  ShortVideoJob,
  ShortVideoPlan,
  ShortVideoAsset,
} from "../src/types.js";

let workspaceRoot: string;

beforeAll(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "dsh-short-video-"));
});

afterAll(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

const ctx = (): ToolContext => ({
  workspaceRoot,
  run: async () => {
    throw new Error("no binary expected for short-video plugin");
  },
  permission: { approved: true },
});

const tool = (name: string) =>
  shortVideoPlugin.tools.find((t) => t.name === name)!;

const validPlanInput = {
  topic: "AI trends 2026",
  aspectRatio: "9:16",
  durationTarget: 30,
  voiceMode: "narrator",
  subtitleMode: "burned",
  assetStrategy: "stock",
  outputDir: "videos/short",
};

describe("short_video_plan (CREATOR-008)", () => {
  it("builds a complete plan from a topic with defaults", async () => {
    const res = await tool("short_video_plan").execute(
      { topic: "AI trends 2026" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const plan = JSON.parse(res.raw!) as ShortVideoPlan;
    expect(plan.script).toContain("AI trends 2026");
    expect(plan.aspectRatio).toBe("9:16");
    expect(plan.outputDir).toBe("short-video");
  });

  it("preserves an explicit script", async () => {
    const res = await tool("short_video_plan").execute(
      { script: "Hello world." },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const plan = JSON.parse(res.raw!) as ShortVideoPlan;
    expect(plan.script).toBe("Hello world.");
  });

  it("rejects a plan with no topic and no script", async () => {
    const res = await tool("short_video_plan").execute({}, ctx());
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
  });

  it("rejects an unsupported aspect ratio", async () => {
    const res = await tool("short_video_plan").execute(
      { topic: "x", aspectRatio: "21:9" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
  });

  it("rejects an out-of-range duration target", async () => {
    const a = await tool("short_video_plan").execute(
      { topic: "x", durationTarget: 1 },
      ctx(),
    );
    const b = await tool("short_video_plan").execute(
      { topic: "x", durationTarget: 9999 },
      ctx(),
    );
    expect(a.error?.code).toBe("InvalidArguments");
    expect(b.error?.code).toBe("InvalidArguments");
  });

  it("rejects an unsafe outputDir (leading dash / control chars)", async () => {
    const a = await tool("short_video_plan").execute(
      { topic: "x", outputDir: "-o" },
      ctx(),
    );
    const b = await tool("short_video_plan").execute(
      { topic: "x", outputDir: "out\r\nx" },
      ctx(),
    );
    expect(a.error?.code).toBe("InvalidArguments");
    expect(b.error?.code).toBe("InvalidArguments");
  });
});

describe("short_video_generate (CREATOR-008)", () => {
  it("rejects generate without a plan", async () => {
    const res = await tool("short_video_generate").execute({}, ctx());
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
  });

  it("rejects a plan whose outputDir escapes the workspace", async () => {
    const res = await tool("short_video_generate").execute(
      { plan: { ...validPlanInput, outputDir: "../outside" } },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("WorkspaceViolation");
  });

  it("submits a mock job and returns a job id", async () => {
    const res = await tool("short_video_generate").execute(
      { plan: validPlanInput, provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const job = JSON.parse(res.raw!) as ShortVideoJob;
    expect(job.id).toMatch(/^mock-/);
    expect(job.status).toBe("queued");
  });

  it("returns a typed Timeout when the poll limit is reached without completion", async () => {
    const res = await tool("short_video_generate").execute(
      { plan: validPlanInput, provider: "mock", waitForComplete: true, maxPollAttempts: 1 },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("Timeout");
  });

  it("surfaces a typed failure for an unconfigured MoneyPrinterTurbo provider", async () => {
    const res = await tool("short_video_generate").execute(
      { plan: validPlanInput, provider: "mpt" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("ToolFailure");
    expect(res.error?.message.toLowerCase()).toContain("not configured");
  });
});

describe("short_video_status (CREATOR-008)", () => {
  it("polls a mock job to completion", async () => {
    const gen = await tool("short_video_generate").execute(
      { plan: validPlanInput, provider: "mock" },
      ctx(),
    );
    const job = JSON.parse(gen.raw!) as ShortVideoJob;
    let status = await tool("short_video_status").execute(
      { jobId: job.id, provider: "mock" },
      ctx(),
    );
    expect(status.ok).toBe(true);
    expect((JSON.parse(status.raw!) as ShortVideoJob).status).toBe("progressing");
    status = await tool("short_video_status").execute(
      { jobId: job.id, provider: "mock" },
      ctx(),
    );
    expect(status.ok).toBe(true);
    expect((JSON.parse(status.raw!) as ShortVideoJob).status).toBe("complete");
  });

  it("enforces a max poll attempt limit", async () => {
    const gen = await tool("short_video_generate").execute(
      { plan: validPlanInput, provider: "mock", maxPollAttempts: 1 },
      ctx(),
    );
    const job = JSON.parse(gen.raw!) as ShortVideoJob;
    const status = await tool("short_video_status").execute(
      { jobId: job.id, provider: "mock", maxPollAttempts: 1 },
      ctx(),
    );
    expect(status.ok).toBe(false);
    expect(status.error?.code).toBe("Timeout");
  });

  it("reports an unknown job id", async () => {
    const status = await tool("short_video_status").execute(
      { jobId: "missing", provider: "mock" },
      ctx(),
    );
    expect(status.ok).toBe(false);
    expect(status.error?.code).toBe("ToolFailure");
  });
});

describe("short_video_assets / short_video_preview (CREATOR-008)", () => {
  async function completeJob(): Promise<string> {
    const gen = await tool("short_video_generate").execute(
      { plan: validPlanInput, provider: "mock" },
      ctx(),
    );
    const job = JSON.parse(gen.raw!) as ShortVideoJob;
    await tool("short_video_status").execute({ jobId: job.id, provider: "mock" }, ctx());
    await tool("short_video_status").execute({ jobId: job.id, provider: "mock" }, ctx());
    return job.id;
  }

  it("returns assets[] for a completed job (mock E2E)", async () => {
    const jobId = await completeJob();
    const res = await tool("short_video_assets").execute(
      { jobId, provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const assets = JSON.parse(res.raw!) as ShortVideoAsset[];
    expect(assets.length).toBeGreaterThan(0);
    expect(assets.some((a) => a.kind === "video")).toBe(true);
    for (const a of assets) {
      expect(a.path).not.toMatch(/^https?:\/\//);
    }
  });

  it("refuses assets for a job that is not complete", async () => {
    const gen = await tool("short_video_generate").execute(
      { plan: validPlanInput, provider: "mock" },
      ctx(),
    );
    const job = JSON.parse(gen.raw!) as ShortVideoJob;
    const res = await tool("short_video_assets").execute(
      { jobId: job.id, provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
  });

  it("preview returns a local descriptor with no external URL or credentials", async () => {
    const planRes = await tool("short_video_plan").execute(
      { topic: "preview me" },
      ctx(),
    );
    const plan = JSON.parse(planRes.raw!) as ShortVideoPlan;
    const res = await tool("short_video_preview").execute({ plan }, ctx());
    expect(res.ok).toBe(true);
    const raw = JSON.stringify(res.raw ?? res.summary);
    expect(raw).not.toMatch(/https?:\/\//);
    expect(raw).not.toMatch(/(password|token|secret|api[_-]?key)=/i);
  });

  it("does not leak external URLs in any asset result", async () => {
    const jobId = await completeJob();
    const res = await tool("short_video_assets").execute(
      { jobId, provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    expect(res.raw).not.toMatch(/https?:\/\//);
  });
});

describe("contract suite (CREATOR-008)", () => {
  it("passes the shared plugin contract kit", async () => {
    const report = await runContractSuite(shortVideoPlugin, {
      workspaceRoot,
      toolArgs: {
        short_video_plan: {
          valid: { topic: "AI" },
          invalid: {},
        },
        short_video_generate: {
          valid: { plan: validPlanInput, provider: "mock" },
          invalid: {},
        },
        short_video_status: {
          valid: { jobId: "mock-1", provider: "mock" },
          invalid: {},
        },
        short_video_assets: {
          valid: { jobId: "mock-1", provider: "mock" },
          invalid: {},
        },
        short_video_preview: {
          valid: { plan: validPlanInput },
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
