/**
 * creator-radar providers (CREATOR-004).
 *
 * RED: `createProvider` is a stub — it throws "not implemented". Tests are
 * failing. GREEN wires MockRadarProvider (fixture), the RSS provider and the
 * TrendRadar-compatible adapter.
 */
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
    description: "TrendRadar-compatible HTTP/MCP adapter (GPL-3.0, external service; no source copying)",
  },
];

export interface RadarProvider {
  readonly kind: RadarProviderKind;
  fetch(options?: { keyword?: string }): Promise<RadarFetchResult>;
}

/** Build a provider by kind (mock / rss / trendradar). */
export function createProvider(_kind: RadarProviderKind): RadarProvider {
  throw new Error("not implemented: createProvider");
}

/** In-memory helper the mock provider uses (stub). */
export function mockTopics(_keyword?: string): CreatorTopic[] {
  throw new Error("not implemented: mockTopics");
}
