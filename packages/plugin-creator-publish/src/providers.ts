/**
 * creator-publish providers (CREATOR-013).
 *
 * MockPublisher: deterministic in-memory publisher for CI (idempotent by
 * idempotency key; configurable "unknown" outcome to exercise the
 * query-before-resend path). PostizProvider / OfficialApiProvider /
 * LocalAutomationProvider: EXTERNAL adapters only (no vendoring); unconfigured
 * -> typed ToolFailure with a config hint. Postiz is AGPL-3.0 -> API adapter
 * only. LocalAutomationProvider is a CN-platform provider extension — no
 * browser anti-detection logic in core.
 */
import type { PlatformPostDraft } from "@dsh-forge-creator/core";
import type { ToolResult } from "@dsh-forge-creator/core";
import type {
  PlatformCapabilities,
  PostAttemptResult,
  PublishProviderKind,
  PublisherAccount,
} from "./types.js";

const POSTIZ_HINT =
  "Postiz-compatible provider is not configured; set POSTIZ_API_URL / POSTIZ_TOKEN to enable the external API adapter (AGPL-3.0 upstream, API only — no source copying), or use the built-in mock provider for deterministic CI";
const OFFICIAL_HINT =
  "Official API provider is not configured; configure platform credentials to enable first-party API publishing";
const LOCAL_HINT =
  "Local automation provider is not configured; set LOCAL_AUTOMATION_CMD to enable it (CN-platform provider extension — no browser anti-detection logic lives in core)";

const MOCK_ACCOUNTS: PublisherAccount[] = [
  { id: "acct-xhs", platform: "xiaohongshu", handle: "@mock-xhs", capabilities: ["image", "video", "text"] },
  { id: "acct-yt", platform: "youtube", handle: "@mock-yt", capabilities: ["video", "image", "text"] },
  { id: "acct-bili", platform: "bilibili", handle: "@mock-bili", capabilities: ["video", "image", "text"] },
];

const MOCK_CAPABILITIES: PlatformCapabilities[] = [
  { platform: "xiaohongshu", media: ["image", "video", "text"], scheduling: false, apiPublish: true },
  { platform: "youtube", media: ["video", "image", "text"], scheduling: true, apiPublish: true },
  { platform: "bilibili", media: ["video", "image", "text"], scheduling: true, apiPublish: true },
  { platform: "x", media: ["image", "text"], scheduling: false, apiPublish: true },
];

export interface PublisherProvider {
  accounts():
    | { ok: true; accounts: PublisherAccount[] }
    | { ok: false; result: ToolResult };
  capabilities():
    | { ok: true; capabilities: PlatformCapabilities[] }
    | { ok: false; result: ToolResult };
  publish(
    draft: PlatformPostDraft,
    idempotencyKey: string,
    scheduledAt?: string,
  ): { ok: true; result: PostAttemptResult } | { ok: false; result: ToolResult };
  status(
    idempotencyKey: string,
  ): { ok: true; result: PostAttemptResult } | { ok: false; result: ToolResult };
  cancel(
    scheduleId: string,
  ): { ok: true; result: { cancelled: boolean } } | { ok: false; result: ToolResult };
}

export interface MockPublisherOptions {
  /**
   * "published": publish records + reports published.
   * "unknown": publish records but reports status unknown (exercises
   *             query-before-resend).
   * "failed": publish records NOTHING and reports a request failure
   *           (exercises the safe-retry path; a retry with the same key
   *           must not duplicate the post).
   */
  publishOutcome?: "published" | "unknown" | "failed";
}

export class MockPublisher implements PublisherProvider {
  publishOutcome: "published" | "unknown" | "failed";
  publishCallCount = 0;
  postCount = 0;
  private readonly posts = new Map<
    string,
    { postId: string; status: "published" | "scheduled"; platform: string }
  >();

  constructor(options: MockPublisherOptions = {}) {
    this.publishOutcome = options.publishOutcome ?? "published";
  }

  accounts(): { ok: true; accounts: PublisherAccount[] } {
    return { ok: true, accounts: MOCK_ACCOUNTS };
  }

  capabilities(): { ok: true; capabilities: PlatformCapabilities[] } {
    return { ok: true, capabilities: MOCK_CAPABILITIES };
  }

  publish(
    draft: PlatformPostDraft,
    idempotencyKey: string,
    scheduledAt?: string,
  ): { ok: true; result: PostAttemptResult } {
    this.publishCallCount += 1;
    const existing = this.posts.get(idempotencyKey);
    if (existing) {
      return { ok: true, result: { postId: existing.postId, status: existing.status } };
    }
    // A simulated request failure records NOTHING, so a retry with the same
    // key never duplicates the post.
    if (this.publishOutcome === "failed") {
      return { ok: true, result: { postId: `post-${this.postCount + 1}`, status: "failed", error: "request failed (simulated)" } };
    }
    this.postCount += 1;
    const postId = `post-${this.postCount}`;
    const status: "published" | "scheduled" = scheduledAt ? "scheduled" : "published";
    this.posts.set(idempotencyKey, { postId, status, platform: draft.platform });
    if (this.publishOutcome === "unknown") {
      return { ok: true, result: { postId, status: "unknown" } };
    }
    return { ok: true, result: { postId, status } };
  }

  status(idempotencyKey: string): { ok: true; result: PostAttemptResult } {
    const p = this.posts.get(idempotencyKey);
    if (!p) {
      return { ok: true, result: { postId: idempotencyKey, status: "failed", error: "not found" } };
    }
    return { ok: true, result: { postId: p.postId, status: p.status } };
  }

  cancel(
    scheduleId: string,
  ): { ok: true; result: { cancelled: boolean } } | { ok: false; result: ToolResult } {
    for (const [key, p] of this.posts) {
      if (p.postId === scheduleId) {
        this.posts.delete(key);
        return { ok: true, result: { cancelled: true } };
      }
    }
    return {
      ok: false,
      result: {
        ok: false,
        summary: "schedule not found",
        error: { code: "ToolFailure", message: `no scheduled post with id ${scheduleId}` },
      },
    };
  }
}

/** External adapter that is unconfigured -> typed ToolFailure with a hint. */
class UnconfiguredAdapter implements PublisherProvider {
  constructor(private readonly hint: string) {}

  private fail(): { ok: false; result: ToolResult } {
    return {
      ok: false,
      result: {
        ok: false,
        summary: "provider unavailable",
        error: { code: "ToolFailure", message: this.hint },
      },
    };
  }

  accounts() {
    return this.fail();
  }
  capabilities() {
    return this.fail();
  }
  publish() {
    return this.fail();
  }
  status() {
    return this.fail();
  }
  cancel() {
    return this.fail();
  }
}

/** Module-level singleton so mock drafts/posts share one publisher store. */
const mockSingleton = new MockPublisher();

export function createPublisherProvider(kind: PublishProviderKind): PublisherProvider {
  switch (kind) {
    case "mock":
      return mockSingleton;
    case "postiz":
      return new UnconfiguredAdapter(POSTIZ_HINT);
    case "official":
      return new UnconfiguredAdapter(OFFICIAL_HINT);
    default:
      return new UnconfiguredAdapter(LOCAL_HINT);
  }
}

/** Test hook for the deterministic mock (documented; used by publish tests). */
export const __mockPublisher = mockSingleton;
