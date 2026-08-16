/**
 * creator-radar fixture data (CREATOR-004).
 *
 * Deterministic, license-safe fixtures: CI never depends on live network.
 * Raw entries are normalized through `normalizeTopic` exactly like provider
 * output. Topic t1 intentionally appears from two sources (dedup test);
 * topic t4 intentionally has no publishedAt (no-fabricated-freshness test).
 */
import type { RawTopic } from "./types.js";

export const MOCK_RAW_TOPICS: readonly RawTopic[] = [
  {
    id: "t1",
    source: "mock:ai",
    title: "DeepSeek R2 开源影响",
    sourceUrl: "https://example.invalid/t1",
    publishedAt: "2026-08-15T10:00:00Z",
    velocity: 0.8,
    competition: 0.6,
  },
  {
    id: "t2",
    source: "mock:ai",
    title: "AI 智能体自主完成科研实验",
    sourceUrl: "https://example.invalid/t2",
    publishedAt: "2026-08-16T08:00:00Z",
    velocity: 0.9,
    competition: 0.4,
  },
  {
    id: "t3",
    source: "mock:ai",
    title: "多模态视频理解新基准",
    sourceUrl: "https://example.invalid/t3",
    publishedAt: "2026-08-14T09:00:00Z",
    velocity: 0.5,
    competition: 0.7,
  },
  {
    id: "t4",
    source: "mock:ai",
    title: "本地小模型推理优化",
    sourceUrl: "https://example.invalid/t4",
    velocity: 0.4,
  },
  // Same logical topic from a second source — dedup must collapse it.
  {
    id: "t1",
    source: "mock:tech",
    title: "DeepSeek R2 开源影响",
    sourceUrl: "https://example.invalid/t1b",
    publishedAt: "2026-08-15T10:00:00Z",
    velocity: 0.8,
    competition: 0.6,
  },
];

/** A deterministic RSS feed fixture (RSS 2.0). */
export const MOCK_RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>AI 科普测试源</title>
  <item>
    <title>RSS: 大模型幻觉检测新方法</title>
    <link>https://example.invalid/rss1</link>
    <pubDate>Sat, 16 Aug 2026 08:00:00 GMT</pubDate>
  </item>
  <item>
    <title>RSS: AI 编程助手对比评测</title>
    <link>https://example.invalid/rss2</link>
    <pubDate>Fri, 15 Aug 2026 12:00:00 GMT</pubDate>
  </item>
</channel>
</rss>`;
