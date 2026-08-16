/**
 * creator-short-video providers (CREATOR-008).
 *
 * MockShortVideoProvider: deterministic in-memory job lifecycle (queued ->
 * progressing -> complete) shared by a module-level singleton so the
 * generate/status/assets tools observe the same job store. A sample completed
 * job ("mock-1") is pre-seeded so stateless status/assets checks are
 * deterministic.
 * MoneyPrinterTurbo-compatible provider: external adapter (MIT upstream, no
 * vendoring); returns a typed ToolFailure with a config hint when not
 * configured.
 */
import type { ToolResult } from "@dsh-forge-creator/core";
import {
  SHORT_VIDEO_STATUS_POLL_LIMIT,
  type ShortVideoAsset,
  type ShortVideoJob,
  type ShortVideoPlan,
  type ShortVideoProviderKind,
} from "./types.js";

const MPT_HINT =
  "MoneyPrinterTurbo-compatible provider is not configured; set MONEY_PRINTER_TURBO_ENDPOINT (or MONEY_PRINTER_TURBO_CLI) to enable it, or use the built-in mock provider for deterministic CI planning";

let mockCounter = 0;

const SAMPLE_PLAN: ShortVideoPlan = {
  script: "Sample short video",
  aspectRatio: "9:16",
  durationTarget: 30,
  voiceMode: "default",
  subtitleMode: "none",
  assetStrategy: "stock",
  outputDir: "sample",
};

export interface MockShortVideoProviderOptions {
  /** Polls after submit before the job flips to complete (default 2). */
  completeAfterPolls?: number;
  /** Cap on attempts before the provider flags a job as timed out. */
  maxAttempts?: number;
}

export class MockShortVideoProvider {
  private readonly jobs = new Map<string, ShortVideoJob>();
  private readonly completeAfterPolls: number;
  private readonly maxAttempts: number;

  constructor(options: MockShortVideoProviderOptions = {}) {
    this.completeAfterPolls = options.completeAfterPolls ?? 2;
    this.maxAttempts = options.maxAttempts ?? SHORT_VIDEO_STATUS_POLL_LIMIT;
  }

  /** Create and complete a job immediately (used for the seeded sample). */
  seedCompleted(plan: ShortVideoPlan): ShortVideoJob {
    const created = this.submit(plan);
    const job = created.job;
    let guard = 0;
    while (job.attempts < this.completeAfterPolls && guard < 100) {
      const r = this.poll(job.id);
      if (!r.ok) break;
      guard += 1;
    }
    return this.jobs.get(job.id) ?? job;
  }

  submit(plan: ShortVideoPlan): { ok: true; job: ShortVideoJob } {
    mockCounter += 1;
    const job: ShortVideoJob = {
      id: `mock-${mockCounter}`,
      plan,
      status: "queued",
      attempts: 0,
    };
    this.jobs.set(job.id, job);
    return { ok: true, job };
  }

  poll(jobId: string): { ok: true; job: ShortVideoJob } | { ok: false; result: ToolResult } {
    const job = this.jobs.get(jobId);
    if (!job) {
      return {
        ok: false,
        result: {
          ok: false,
          summary: "job not found",
          error: { code: "ToolFailure", message: `unknown short-video job: ${jobId}` },
        },
      };
    }
    if (job.status === "complete" || job.status === "failed") return { ok: true, job };
    job.attempts += 1;
    // The complete branch is checked first, so under the default
    // configuration (completeAfterPolls < maxAttempts) the timeout branch is
    // only reachable when completeAfterPolls > maxAttempts — i.e. a provider
    // configured to never complete in time. Tool-level Timeout enforcement
    // lives in index.ts (generate/status poll caps).
    if (job.attempts >= this.completeAfterPolls) {
      job.status = "complete";
    } else if (job.attempts > this.maxAttempts) {
      job.status = "failed";
      job.error = "timed out";
    } else {
      job.status = "progressing";
    }
    return { ok: true, job };
  }

  assets(jobId: string): { ok: true; assets: ShortVideoAsset[] } | { ok: false; result: ToolResult } {
    const job = this.jobs.get(jobId);
    if (!job) {
      return {
        ok: false,
        result: {
          ok: false,
          summary: "job not found",
          error: { code: "ToolFailure", message: `unknown short-video job: ${jobId}` },
        },
      };
    }
    if (job.status !== "complete") {
      return {
        ok: false,
        result: {
          ok: false,
          summary: "job not complete",
          error: {
            code: "ToolFailure",
            message: `short-video job ${jobId} is ${job.status}; wait for completion before listing assets`,
          },
        },
      };
    }
    const dir = job.plan.outputDir;
    const r = job.plan.aspectRatio;
    return {
      ok: true,
      assets: [
        { kind: "video", path: `${dir}/video.mp4`, aspectRatio: r },
        { kind: "audio", path: `${dir}/audio.m4a`, aspectRatio: r },
        {
          kind: "subtitle",
          path: `${dir}/subtitle.${job.plan.subtitleMode === "none" ? "txt" : "srt"}`,
          aspectRatio: r,
        },
        { kind: "thumbnail", path: `${dir}/thumb.png`, aspectRatio: r },
      ],
    };
  }
}

export interface ShortVideoProvider {
  submit(
    plan: ShortVideoPlan,
  ): { ok: true; job: ShortVideoJob } | { ok: false; result: ToolResult };
  poll(
    jobId: string,
  ): { ok: true; job: ShortVideoJob } | { ok: false; result: ToolResult };
  assets(
    jobId: string,
  ): { ok: true; assets: ShortVideoAsset[] } | { ok: false; result: ToolResult };
}

/** Module-level singleton so all mock tool calls share one job store. */
const mockSingleton = new MockShortVideoProvider();
mockSingleton.seedCompleted(SAMPLE_PLAN);

export function createShortVideoProvider(
  kind: ShortVideoProviderKind,
): ShortVideoProvider {
  if (kind === "mock") return mockSingleton;
  // MoneyPrinterTurbo-compatible adapter (MIT upstream, external). No
  // vendoring: without an endpoint/CLI configured, every operation is a
  // typed ToolFailure with a config hint.
  return {
    submit: () => ({
      ok: false,
      result: {
        ok: false,
        summary: "provider unavailable",
        error: { code: "ToolFailure", message: MPT_HINT },
      },
    }),
    poll: () => ({
      ok: false,
      result: {
        ok: false,
        summary: "provider unavailable",
        error: { code: "ToolFailure", message: MPT_HINT },
      },
    }),
    assets: () => ({
      ok: false,
      result: {
        ok: false,
        summary: "provider unavailable",
        error: { code: "ToolFailure", message: MPT_HINT },
      },
    }),
  };
}

export { MPT_HINT };
