/**
 * creator-radar normalization & scoring (CREATOR-004).
 *
 * RED: helpers below are stubs — they throw "not implemented". Tests are
 * failing. GREEN implements normalization, dedup, scoring and RSS parsing.
 */
import type {
  CreatorTopic,
  RawTopic,
  TopicScoreBreakdown,
} from "./types.js";

function notImplemented(name: string): never {
  throw new Error(`not implemented: ${name}`);
}

/** Normalize a raw provider topic into a consistent CreatorTopic shape. */
export function normalizeTopic(
  _raw: RawTopic,
  _source: string,
): CreatorTopic {
  return notImplemented("normalizeTopic");
}

/** Remove duplicate topics (by id), keeping the first occurrence. */
export function dedupeTopics(
  _topics: readonly CreatorTopic[],
): CreatorTopic[] {
  return notImplemented("dedupeTopics");
}

/**
 * Score a topic with evidence. Missing signals are never fabricated; when no
 * evidence exists the opportunity stays undefined/uncertain.
 */
export function scoreTopic(
  _topic: CreatorTopic,
  _creatorFit?: number,
): TopicScoreBreakdown {
  return notImplemented("scoreTopic");
}

/** Rank topics by opportunity (descending), deterministic tie-break by id. */
export function rankByOpportunity(
  _topics: readonly CreatorTopic[],
): CreatorTopic[] {
  return notImplemented("rankByOpportunity");
}

/** Parse RSS 2.0 XML into raw topics (title/link/pubDate). */
export function parseRss(_xml: string): RawTopic[] {
  return notImplemented("parseRss");
}
