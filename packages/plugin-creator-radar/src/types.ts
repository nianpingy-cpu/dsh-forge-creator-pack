/**
 * creator-radar domain types (CREATOR-004).
 */
export type RadarProviderKind = "mock" | "rss" | "trendradar";

/** A normalized, evidence-backed creator topic candidate. */
export interface CreatorTopic {
  id: string;
  title: string;
  source: string;
  sourceUrl?: string;
  publishedAt?: string;
  freshness?: number;
  velocity?: number;
  competition?: number;
  creatorFit?: number;
  opportunity?: number;
  evidence: string[];
}

/** A topic as it arrives from a raw provider (pre-normalization). */
export interface RawTopic {
  title: string;
  sourceUrl?: string;
  publishedAt?: string;
  /** Provider-specific numeric signals, optional. */
  velocity?: number;
  competition?: number;
  /** Opaque provider metadata, retained as evidence. */
  meta?: Record<string, unknown>;
}

export interface RadarSource {
  id: string;
  name: string;
  provider: RadarProviderKind;
  description: string;
}

export interface TopicScoreBreakdown {
  topicId: string;
  title: string;
  scores: {
    freshness?: number;
    velocity?: number;
    competition?: number;
    creatorFit?: number;
    opportunity?: number;
  };
  evidence: string[];
  uncertainty: string[];
}

export interface RadarFetchResult {
  ok: boolean;
  topics: CreatorTopic[];
  /** Normalized provider error (never a raw stack trace). */
  error?: { code: string; message: string };
}
