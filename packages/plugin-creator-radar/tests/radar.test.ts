import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { radarPlugin } from "@dsh-forge-creator/plugin-creator-radar";
import {
  runContractSuite,
  type ExecutionResult,
  type ToolContext,
} from "@dsh-forge-creator/core";
import type { CreatorTopic, TopicScoreBreakdown } from "../src/types.js";

let workspaceRoot: string;

beforeAll(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "dsh-radar-"));
});

afterAll(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

const OK: ExecutionResult = {
  exitCode: 0,
  stdout: "",
  stderr: "",
  timedOut: false,
  aborted: false,
  truncated: false,
  durationMs: 1,
};

const testCtx = (): ToolContext => ({
  workspaceRoot,
  run: async () => OK,
  permission: { approved: true },
});

const tool = (name: string) =>
  radarPlugin.tools.find((t) => t.name === name)!;

async function fetchTopicsRaw(source: string) {
  const res = await tool("trend_fetch").execute({ source }, testCtx());
  expect(res.ok, `trend_fetch(${source}) should succeed`).toBe(true);
  return JSON.parse(res.raw!) as CreatorTopic[];
}

describe("normalization consistency (CREATOR-004)", () => {
  it("mock and rss providers normalize to the same shape", async () => {
    const mockTopics = await fetchTopicsRaw("mock");
    const rssTopics = await fetchTopicsRaw("rss");
    expect(mockTopics.length).toBeGreaterThan(0);
    expect(rssTopics.length).toBeGreaterThan(0);
    for (const field of ["id", "title", "source", "evidence"]) {
      expect(mockTopics[0]).toHaveProperty(field);
      expect(rssTopics[0]).toHaveProperty(field);
    }
    // Every RSS topic is normalized into the canonical key set.
    for (const topic of rssTopics) {
      expect(typeof topic.id).toBe("string");
      expect(typeof topic.title).toBe("string");
      expect(typeof topic.source).toBe("string");
      expect(Array.isArray(topic.evidence)).toBe(true);
    }
  });
});

describe("no fabricated signals (CREATOR-004)", () => {
  it("does not fabricate freshness when publishedAt is missing", async () => {
    // t4 has no publishedAt in the fixture.
    const res = await tool("topic_score").execute({ topicId: "t4" }, testCtx());
    expect(res.ok).toBe(true);
    const breakdown = JSON.parse(res.raw!) as TopicScoreBreakdown;
    expect(breakdown.scores.freshness).toBeUndefined();
    expect(breakdown.evidence.join(" ").toLowerCase()).toContain("published");
  });

  it("does not fabricate a certain opportunity without evidence", async () => {
    const res = await tool("topic_score").execute({ topicId: "t4" }, testCtx());
    expect(res.ok).toBe(true);
    const breakdown = JSON.parse(res.raw!) as TopicScoreBreakdown;
    expect(breakdown.scores.opportunity).not.toBe(1);
    expect(breakdown.uncertainty.length).toBeGreaterThan(0);
  });
});

describe("typed provider errors (CREATOR-004)", () => {
  it("returns a typed error when a network provider is unavailable/times out", async () => {
    const res = await tool("trend_fetch").execute(
      { source: "trendradar" },
      testCtx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBeDefined();
    expect(["Timeout", "ToolFailure"]).toContain(res.error!.code);
    expect(res.error!.message.length).toBeGreaterThan(0);
  });
});

describe("deduplication (CREATOR-004)", () => {
  it("dedupes duplicate topics across sources", async () => {
    const topics = await fetchTopicsRaw("mock");
    const ids = topics.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id === "t1").length).toBe(1);
  });
});

describe("opportunity ranking (CREATOR-004)", () => {
  it("ranks topics by opportunity with traceable output", async () => {
    const res = await tool("opportunity_rank").execute({}, testCtx());
    expect(res.ok).toBe(true);
    const ranked = JSON.parse(res.raw!) as CreatorTopic[];
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.length).toBeLessThanOrEqual(3);
    for (const topic of ranked) {
      expect(Array.isArray(topic.evidence)).toBe(true);
      expect(topic.evidence.length).toBeGreaterThan(0);
    }
  });
});

describe("contract suite (CREATOR-004)", () => {
  it("passes the shared plugin contract kit", async () => {
    const report = await runContractSuite(radarPlugin, {
      workspaceRoot,
      missingBinaryTool: "radar_probe",
      toolArgs: {
        trend_sources: { valid: {}, invalid: { unknown: true } },
        trend_fetch: { valid: { source: "mock" }, invalid: { source: "nope" } },
        trend_search: { valid: { query: "AI" }, invalid: {} },
        topic_score: { valid: { topicId: "t1" }, invalid: {} },
        topic_compare: {
          valid: { leftId: "t1", rightId: "t2" },
          invalid: {},
        },
        topic_history: { valid: { topicId: "t1" }, invalid: {} },
        topic_velocity: { valid: { topicId: "t1" }, invalid: {} },
        competitor_watch: { valid: { query: "AI" }, invalid: {} },
        opportunity_rank: { valid: {}, invalid: { limit: "x" } },
        radar_probe: { valid: {}, invalid: { unknown: true } },
      },
    });
    expect(report.passed).toBe(true);
    if (!report.passed) {
      const failed = report.checks.filter((c) => !c.passed);
      process.stderr.write(JSON.stringify(failed, null, 2) + "\n");
    }
  });
});
