/**
 * creator-radar providers (CREATOR-004).
 *
 * GREEN: MockRadarProvider (deterministic fixture, CI-safe), the RSS provider
 * (feed XML as data — RSSHub is AGPL-3.0, consumed over HTTP only) and the
 * TrendRadar-compatible adapter (GPL-3.0, external service; never configured
 * in CI, so it returns a typed provider error instead of calling the network).
 */
import { MOCK_TOPICS, MOCK_RSS_XML } from "./fixture.js";
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

/** In-memory mock topics, optionally keyword-filtered. */
export function mockTopics(keyword?: string): CreatorTopic[] {
  const topics = keyword
    ? MOCK_TOPICS.filter((t) =>
        t.title.toLowerCase().includes(keyword.toLowerCase()),
      )
    : [...MOCK_TOPICS];
  return topics;
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
          const raw = parseRss(MOCK_RSS_XML);
          return {
            ok: true,
            topics: raw.map((topic) => normalizeTopic(topic, "rss")),
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
              code: "Timeout",
              message:
                "TrendRadar-compatible provider is not configured; configure an HTTP/MCP endpoint or use the mock/rss sources (GPL-3.0 upstream, adapter only)",
            },
          };
        },
      };
  }
}

