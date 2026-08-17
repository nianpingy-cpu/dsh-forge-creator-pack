/**
 * creator-radar normalization & scoring (CREATOR-004).
 *
 * GREEN: normalization, dedup, scoring and RSS parsing. Missing signals are
 * never fabricated — freshness/velocity/competition/opportunity stay
 * undefined (or explicitly uncertain) when no evidence exists, and every
 * ranking traces back to source/evidence.
 */
import type {
  CreatorTopic,
  RawTopic,
  TopicScoreBreakdown,
} from "./types.js";

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Deterministic, stable id derived from title (cross-source dedup key). */
function deriveId(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) {
    h = (h * 31 + title.charCodeAt(i)) | 0;
  }
  return `topic-${Math.abs(h).toString(36)}`;
}

/** Normalize a raw provider topic into a consistent CreatorTopic shape. */
export function normalizeTopic(raw: RawTopic): CreatorTopic {
  const source = raw.source;
  const topic: CreatorTopic = {
    id: raw.id ?? deriveId(raw.title),
    title: raw.title,
    source,
    evidence: [`${source}: ${raw.title}`],
  };
  if (raw.sourceUrl) {
    topic.sourceUrl = raw.sourceUrl;
    topic.evidence.push(`source: ${raw.sourceUrl}`);
  }
  // Absent publishedAt => no freshness later (never fabricated).
  if (raw.publishedAt) topic.publishedAt = raw.publishedAt;
  if (raw.velocity !== undefined) topic.velocity = raw.velocity;
  if (raw.competition !== undefined) topic.competition = raw.competition;
  if (raw.meta) {
    for (const [key, value] of Object.entries(raw.meta)) {
      if (typeof value === "string" || typeof value === "number") {
        topic.evidence.push(`${key}=${String(value)}`);
      }
    }
  }
  return topic;
}

/** Remove duplicate topics (by id), keeping the first occurrence. */
export function dedupeTopics(
  topics: readonly CreatorTopic[],
): CreatorTopic[] {
  const seen = new Set<string>();
  const out: CreatorTopic[] = [];
  for (const topic of topics) {
    if (!seen.has(topic.id)) {
      seen.add(topic.id);
      out.push(topic);
    }
  }
  return out;
}

/**
 * Score a topic with evidence. Missing signals are never fabricated; when no
 * evidence exists the opportunity stays undefined/uncertain.
 */
export function scoreTopic(
  topic: CreatorTopic,
  creatorFit?: number,
  now: number = Date.now(),
): TopicScoreBreakdown {
  const evidence: string[] = [...topic.evidence];
  const uncertainty: string[] = [];
  const scores: TopicScoreBreakdown["scores"] = {};

  if (topic.publishedAt) {
    const parsed = Date.parse(topic.publishedAt);
    const ageDays = Number.isFinite(parsed)
      ? Math.max(0, now - parsed) / 86_400_000
      : undefined;
    if (ageDays === undefined) {
      uncertainty.push("publishedAt is not parseable; freshness not estimated");
    } else {
      const freshness = clamp01(1 - ageDays / 30);
      scores.freshness = round3(freshness);
      evidence.push(`freshness=${round3(freshness)} from publishedAt=${topic.publishedAt}`);
    }
  } else {
    uncertainty.push("no published date; freshness not estimated (not fabricated)");
    evidence.push("no publishedAt; freshness left undefined");
  }

  if (topic.velocity !== undefined) {
    scores.velocity = round3(clamp01(topic.velocity));
    evidence.push(`velocity=${round3(clamp01(topic.velocity))} from provider signal`);
  } else {
    uncertainty.push("no velocity signal from provider");
    evidence.push("velocity undefined (no provider signal)");
  }

  if (topic.competition !== undefined) {
    scores.competition = round3(clamp01(topic.competition));
    evidence.push(`competition=${round3(clamp01(topic.competition))}`);
  } else {
    uncertainty.push("no competition signal");
  }

  if (creatorFit !== undefined) {
    scores.creatorFit = round3(clamp01(creatorFit));
    evidence.push(`creatorFit=${round3(clamp01(creatorFit))} (user input)`);
  } else {
    uncertainty.push("creatorFit not provided");
  }

  // Opportunity aggregates ONLY evidence-backed signals and is never a
  // certain (1.0) value without evidence.
  const available: number[] = [];
  if (scores.freshness !== undefined) available.push(scores.freshness);
  if (scores.velocity !== undefined) available.push(scores.velocity);
  if (scores.creatorFit !== undefined) available.push(scores.creatorFit);
  if (available.length === 0) {
    uncertainty.push("opportunity not estimated: no evidence-backed signals");
    evidence.push("opportunity undefined (no evidence)");
  } else {
    const opportunity =
      available.reduce((sum, value) => sum + value, 0) / available.length;
    scores.opportunity = round3(Math.min(0.99, opportunity));
    evidence.push(
      `opportunity=${round3(scores.opportunity)} from ${available.length} evidence-backed signal(s)`,
    );
  }

  return { topicId: topic.id, title: topic.title, scores, evidence, uncertainty };
}

/** Rank topics by opportunity (descending), deterministic tie-break by id. */
export function rankByOpportunity(
  topics: readonly CreatorTopic[],
): CreatorTopic[] {
  return [...topics]
    .map((topic) => ({
      topic,
      opportunity: scoreTopic(topic).scores.opportunity ?? -1,
    }))
    .sort(
      (a, b) =>
        b.opportunity - a.opportunity ||
        (a.topic.id < b.topic.id ? -1 : a.topic.id > b.topic.id ? 1 : 0),
    )
    .map((entry) => entry.topic);
}

/** Extract a text node (handling optional CDATA). */
function extractText(block: string, tag: string): string | undefined {
  const match = block.match(
    new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, "i"),
  );
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : undefined;
}

/** Parse RSS 2.0 XML into raw topics (title/link/pubDate), source added by the provider. */
export function parseRss(xml: string): Omit<RawTopic, "source">[] {
  const topics: Omit<RawTopic, "source">[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1] ?? "";
    const title = extractText(block, "title");
    if (!title) continue;
    const link = extractText(block, "link");
    const pubDate = extractText(block, "pubDate");
    const parsed = pubDate ? new Date(pubDate) : undefined;
    topics.push({
      title,
      sourceUrl: link,
      publishedAt:
        parsed && !Number.isNaN(parsed.getTime())
          ? parsed.toISOString()
          : undefined,
    });
  }
  return topics;
}

