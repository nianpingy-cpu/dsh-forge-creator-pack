/**
 * creator-radar providers (CREATOR-004).
 *
 * GREEN: MockRadarProvider (deterministic fixture, CI-safe), the RSS provider
 * (feed XML as data — RSSHub is AGPL-3.0, consumed over HTTP only) and the
 * TrendRadar-compatible adapter (GPL-3.0, external service; never configured
 * in CI, so it returns a typed provider error instead of calling the network).
 */
import { MOCK_RAW_TOPICS, MOCK_RSS_XML } from "./fixture.js";
import { normalizeTopic, parseRss } from "./normalize.js";
import type {
  CreatorTopic,
  RadarFetchResult,
  RadarProviderKind,
  RadarSource,
} from "./types.js";

export const SOURCES: readonly RadarSource[] = [
  {
    id: "mock",
    name: "Mock Radar",
    provider: "mock",
    description: "Deterministic local fixture (CI-safe)",
  },
  {
    id: "rss",
    name: "RSS feeds",
    provider: "rss",
    description: "RSS 2.0 feed parsing (adapter; feeds as data)",
  },
  {
    id: "trendradar",
    name: "TrendRadar-compatible",
    provider: "trendradar",
    description:
      "TrendRadar-compatible HTTP/MCP adapter (GPL-3.0, external service; no source copying)",
  },
];

export interface RadarProvider {
  readonly kind: RadarProviderKind;
  fetch(options?: { keyword?: string }): Promise<RadarFetchResult>;
}

/** In-memory mock topics (normalized through normalizeTopic), keyword-filtered. */
export function mockTopics(keyword?: string): CreatorTopic[] {
  const raw = keyword
    ? MOCK_RAW_TOPICS.filter((t) =>
        t.title.toLowerCase().includes(keyword.toLowerCase()),
      )
    : [...MOCK_RAW_TOPICS];
  return raw.map((topic) => normalizeTopic(topic));
}

/** Build a provider by kind (mock / rss / trendradar). */
export function createProvider(kind: RadarProviderKind): RadarProvider {
  switch (kind) {
    case "mock":
      return {
        kind,
        async fetch(options) {
          return { ok: true, topics: mockTopics(options?.keyword) };
        },
      };
    case "rss":
      return {
        kind,
        async fetch() {
          const raw = parseRss(MOCK_RSS_XML).map((topic) => ({
            ...topic,
            source: "rss",
          }));
          return {
            ok: true,
            topics: raw.map((topic) => normalizeTopic(topic)),
          };
        },
      };
    case "trendradar":
      return {
        kind,
        async fetch() {
          return {
            ok: false,
            error: {
              code: "ToolFailure",
              message:
                "TrendRadar-compatible provider is not configured; configure an HTTP/MCP endpoint or use the mock/rss sources (GPL-3.0 upstream, adapter only)",
            },
          };
        },
      };
    default:
      // Unreachable from the validated tool surface (enum-gated), but a
      // normalized error keeps the provider boundary total.
      return {
        kind,
        async fetch() {
          return {
            ok: false,
            error: {
              code: "ToolFailure",
              message: `unsupported radar provider kind: ${kind}`,
            },
          };
        },
      };
  }
}


