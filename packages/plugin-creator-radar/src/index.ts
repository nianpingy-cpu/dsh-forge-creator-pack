/**
 * creator-radar plugin (CREATOR-004).
 *
 * Hot-topic & topic-scoring radar: normalized, evidence-backed topic
 * candidates with scores that always trace back to source/evidence.
 *
 *   trend_sources       (read)  list configured radar sources
 *   trend_fetch         (read)  fetch normalized topics from a source
 *   trend_search        (read)  search topics by keyword
 *   topic_score         (read)  score one topic with evidence + uncertainty
 *   topic_compare       (read)  compare two topics
 *   topic_history       (read)  topic history (mock)
 *   topic_velocity      (read)  velocity estimate (evidence-backed)
 *   competitor_watch    (read)  competitor topics for a query
 *   opportunity_rank    (read)  rank topics by opportunity
 *   radar_probe         (read)  probe external radar CLI availability
 *
 * (RED — normalization/providers are stubs; tools return ToolFailure until
 * GREEN implements them.)
 */
import {
  validateArgs,
  type Plugin,
  type ToolDefinition,
  type ToolResult,
  type ToolContext,
  type ExecutionResult,
} from "@dsh-forge-creator/core";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  dedupeTopics,
  scoreTopic,
  rankByOpportunity,
} from "./normalize.js";
import { createProvider, SOURCES } from "./providers.js";
import type { CreatorTopic, RadarProviderKind } from "./types.js";

const CORE_VERSION = "0.1.0" as const;

function invalid(message: string): ToolResult {
  return {
    ok: false,
    summary: "invalid arguments",
    error: { code: "InvalidArguments", message },
  };
}

function toolFailure(message: string): ToolResult {
  return {
    ok: false,
    summary: "radar failed",
    error: { code: "ToolFailure", message },
  };
}

function typedProviderError(code: string, message: string): ToolResult {
  return {
    ok: false,
    summary: "radar provider error",
    error: { code: code === "Timeout" ? "Timeout" : "ToolFailure", message },
  };
}

function success(summary: string, payload: unknown): ToolResult {
  return { ok: true, summary, raw: JSON.stringify(payload) };
}

function validate(schema: ToolDefinition["inputSchema"], args: unknown): ToolResult | null {
  const outcome = validateArgs(schema, args);
  if (!outcome.ok) return invalid(outcome.error);
  return null;
}

/** Fetch + dedupe topics from a source (typed errors only). */
async function fetchTopics(
  ctx: ToolContext,
  source: string | undefined,
  keyword?: string,
): Promise<{ ok: true; topics: CreatorTopic[] } | { ok: false; result: ToolResult }> {
  const kind = (source as RadarProviderKind | undefined) ?? "mock";
  let provider;
  try {
    provider = createProvider(kind);
  } catch (err) {
    return {
      ok: false,
      result: toolFailure(`provider unavailable: ${String(err)}`),
    };
  }
  const res = await provider.fetch({ keyword });
  if (!res.ok) {
    return {
      ok: false,
      result: typedProviderError(
        res.error?.code ?? "ToolFailure",
        res.error?.message ?? "provider fetch failed",
      ),
    };
  }
  return { ok: true, topics: dedupeTopics(res.topics) };
}

/** Resolve a topic by id from the mock source (used by scoring tools). */
async function findTopic(
  ctx: ToolContext,
  topicId: string,
): Promise<{ ok: true; topic: CreatorTopic } | { ok: false; result: ToolResult }> {
  const fetched = await fetchTopics(ctx, "mock");
  if (!fetched.ok) return fetched;
  const topic = fetched.topics.find((t) => t.id === topicId);
  if (!topic) {
    return {
      ok: false,
      result: invalid(`unknown topic id: ${topicId}`),
    };
  }
  return { ok: true, topic };
}

const trendSources: ToolDefinition = {
  name: "trend_sources",
  description:
    "List configured radar sources (mock / rss / trendradar-compatible) with their provider kind.",
  mutationClass: "read",
  inputSchema: { type: "object", properties: {} },
  async execute(args, ctx) {
    const bad = validate(trendSources.inputSchema, args);
    if (bad) return bad;
    return success(`${SOURCES.length} radar sources`, SOURCES);
  },
};

const trendFetch: ToolDefinition = {
  name: "trend_fetch",
  description:
    "Fetch normalized topic candidates from a radar source (default mock). Returns deduplicated CreatorTopic[].",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      source: {
        type: "string",
        description: "mock | rss | trendradar",
        enum: ["mock", "rss", "trendradar"],
      },
      keyword: { type: "string", description: "optional keyword filter" },
    },
    required: [],
  },
  async execute(args, ctx) {
    const bad = validate(trendFetch.inputSchema, args);
    if (bad) return bad;
    const { source, keyword } = args as {
      source?: string;
      keyword?: string;
    };
    const fetched = await fetchTopics(ctx, source, keyword);
    if (!fetched.ok) return fetched.result;
    return success(`fetched ${fetched.topics.length} topics`, fetched.topics);
  },
};

const trendSearch: ToolDefinition = {
  name: "trend_search",
  description:
    "Search topic candidates by keyword across a radar source (default mock).",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "search query" },
      source: {
        type: "string",
        enum: ["mock", "rss", "trendradar"],
      },
    },
    required: ["query"],
  },
  async execute(args, ctx) {
    const bad = validate(trendSearch.inputSchema, args);
    if (bad) return bad;
    const { query, source } = args as { query: string; source?: string };
    const fetched = await fetchTopics(ctx, source);
    if (!fetched.ok) return fetched.result;
    const matches = fetched.topics.filter((t) =>
      t.title.toLowerCase().includes(query.toLowerCase()),
    );
    return success(`found ${matches.length} matches`, matches);
  },
};

const topicScore: ToolDefinition = {
  name: "topic_score",
  description:
    "Score a topic (freshness/velocity/competition/creatorFit/opportunity) with evidence and explicit uncertainty.",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      topicId: { type: "string", description: "topic id" },
      creatorFit: {
        type: "number",
        description: "optional 0..1 creator-fit input",
      },
    },
    required: ["topicId"],
  },
  async execute(args, ctx) {
    const bad = validate(topicScore.inputSchema, args);
    if (bad) return bad;
    const { topicId, creatorFit } = args as {
      topicId: string;
      creatorFit?: number;
    };
    const found = await findTopic(ctx, topicId);
    if (!found.ok) return found.result;
    const breakdown = scoreTopic(found.topic, creatorFit);
    return success(`scored ${found.topic.title}`, breakdown);
  },
};

const topicCompare: ToolDefinition = {
  name: "topic_compare",
  description:
    "Compare two topics by their score breakdowns and highlight the higher-opportunity candidate.",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      leftId: { type: "string", description: "left topic id" },
      rightId: { type: "string", description: "right topic id" },
    },
    required: ["leftId", "rightId"],
  },
  async execute(args, ctx) {
    const bad = validate(topicCompare.inputSchema, args);
    if (bad) return bad;
    const { leftId, rightId } = args as { leftId: string; rightId: string };
    const left = await findTopic(ctx, leftId);
    if (!left.ok) return left.result;
    const right = await findTopic(ctx, rightId);
    if (!right.ok) return right.result;
    const ls = scoreTopic(left.topic);
    const rs = scoreTopic(right.topic);
    const lo = ls.scores.opportunity ?? 0;
    const ro = rs.scores.opportunity ?? 0;
    const winner = lo > ro ? left.topic.title : right.topic.title;
    return success(`winner: ${winner}`, { left: ls, right: rs, winner });
  },
};

const topicHistory: ToolDefinition = {
  name: "topic_history",
  description:
    "Return the (mock) history for a topic: chronological mention events with source evidence.",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      topicId: { type: "string", description: "topic id" },
    },
    required: ["topicId"],
  },
  async execute(args, ctx) {
    const bad = validate(topicHistory.inputSchema, args);
    if (bad) return bad;
    const { topicId } = args as { topicId: string };
    const found = await findTopic(ctx, topicId);
    if (!found.ok) return found.result;
    const history = [
      {
        at: "2026-08-14T09:00:00Z",
        source: found.topic.source,
        event: "first observed",
      },
      {
        at: "2026-08-15T10:00:00Z",
        source: found.topic.source,
        event: "mentions increased",
      },
    ];
    return success(`history for ${found.topic.title}`, history);
  },
};

const topicVelocity: ToolDefinition = {
  name: "topic_velocity",
  description:
    "Estimate a topic's velocity. Never fabricated: without provider data the estimate is undefined with an evidence note.",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      topicId: { type: "string", description: "topic id" },
    },
    required: ["topicId"],
  },
  async execute(args, ctx) {
    const bad = validate(topicVelocity.inputSchema, args);
    if (bad) return bad;
    const { topicId } = args as { topicId: string };
    const found = await findTopic(ctx, topicId);
    if (!found.ok) return found.result;
    return success(
      `velocity for ${found.topic.title}`,
      scoreTopic(found.topic).scores,
    );
  },
};

const competitorWatch: ToolDefinition = {
  name: "competitor_watch",
  description:
    "Watch competing topics for a query: topics with competition data that overlap the query.",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "competitor query" },
    },
    required: ["query"],
  },
  async execute(args, ctx) {
    const bad = validate(competitorWatch.inputSchema, args);
    if (bad) return bad;
    const { query } = args as { query: string };
    const fetched = await fetchTopics(ctx, "mock");
    if (!fetched.ok) return fetched.result;
    const competitors = fetched.topics.filter(
      (t) =>
        t.competition !== undefined &&
        t.title.toLowerCase().includes(query.toLowerCase()),
    );
    return success(`found ${competitors.length} competitors`, competitors);
  },
};

const opportunityRank: ToolDefinition = {
  name: "opportunity_rank",
  description:
    "Rank topics by opportunity (descending). Rankings always trace to source/evidence.",
  mutationClass: "read",
  inputSchema: {
    type: "object",
    properties: {
      keyword: { type: "string", description: "optional keyword filter" },
      limit: {
        type: "number",
        description: "max results (default 3)",
      },
    },
    required: [],
  },
  async execute(args, ctx) {
    const bad = validate(opportunityRank.inputSchema, args);
    if (bad) return bad;
    const { keyword, limit } = args as { keyword?: string; limit?: number };
    const fetched = await fetchTopics(ctx, "mock", keyword);
    if (!fetched.ok) return fetched.result;
    const ranked = rankByOpportunity(fetched.topics).slice(0, limit ?? 3);
    return success(`ranked ${ranked.length} topics`, ranked);
  },
};

/** Absolute sentinel so a missing probe binary maps to BinaryNotFound. */
function resolveProbeBinary(): string {
  return join(tmpdir(), `dsh-radar-probe-${randomUUID()}`);
}

const radarProbe: ToolDefinition = {
  name: "radar_probe",
  description:
    "Probe whether an external radar CLI is installed. Returns BinaryNotFound with an install hint when absent.",
  mutationClass: "read",
  inputSchema: { type: "object", properties: {} },
  async execute(args, ctx) {
    const bad = validate(radarProbe.inputSchema, args);
    if (bad) return bad;
    const binary = resolveProbeBinary();
    let exec: ExecutionResult;
    try {
      exec = await ctx.run({ binary, args: ["--version"], cwd: ctx.workspaceRoot });
    } catch (err) {
      return toolFailure(`radar probe threw: ${String(err)}`);
    }
    if (exec.error?.code === "BinaryNotFound" || exec.exitCode === null) {
      return {
        ok: false,
        summary: "radar CLI binary not found",
        error: {
          code: "BinaryNotFound",
          message:
            "No external radar CLI is configured. Use the built-in mock/rss sources (no binary required).",
        },
      };
    }
    return success(`radar probe exit ${exec.exitCode}`, { exitCode: exec.exitCode });
  },
};

export const radarPlugin: Plugin = {
  metadata: {
    name: "@dsh-forge-creator/plugin-creator-radar",
    version: "0.1.0",
    upstreamTool: "TrendRadar (GPL-3.0, adapter) / RSS (AGPL-3.0, feed data)",
    coreContractVersion: CORE_VERSION,
    capabilities: [
      "trend_sources",
      "trend_fetch",
      "trend_search",
      "topic_score",
      "topic_compare",
      "topic_history",
      "topic_velocity",
      "competitor_watch",
      "opportunity_rank",
    ],
  },
  tools: [
    trendSources,
    trendFetch,
    trendSearch,
    topicScore,
    topicCompare,
    topicHistory,
    topicVelocity,
    competitorWatch,
    opportunityRank,
    radarProbe,
  ],
};
