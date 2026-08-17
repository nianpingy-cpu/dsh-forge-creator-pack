import { describe, expect, it, afterAll } from "vitest";
import { publishPlugin, contentHashOf } from "@dsh-forge-creator/plugin-creator-publish";
import { createApproval, type CreatorApproval, type PlatformPostDraft } from "@dsh-forge-creator/core";
import { __mockPublisher } from "../../packages/plugin-creator-publish/src/providers.js";
import { createE2E } from "./harness.js";

const DRAFT: PlatformPostDraft = {
  platform: "youtube",
  title: "Retry story",
  text: "The remote may have accepted before we saw a response.",
  media: [],
  tags: ["acceptance"],
};

function approvalFor(draft: PlatformPostDraft, ttlMs = 60_000): CreatorApproval {
  return createApproval("creator-remote-publish", contentHashOf(draft), { ttlMs });
}

/**
 * Story G — 重试幂等 (retry idempotency), §30 Scenario 8.
 *
 * publish request -> remote accepted but response unknown -> status query ->
 * discover already published -> DO NOT publish again. The mock publisher is
 * forced to report an unknown outcome; the tool queries status and resolves to
 * published with exactly ONE post created (postCount delta 1). Deterministic.
 */
describe("E2E Story G — 重试幂等 (CREATOR-016 §30 S8)", () => {
  const e2e = createE2E([publishPlugin]);
  afterAll(() => e2e.cleanup());

  it("status unknown -> query -> already published -> no duplicate post", async () => {
    const created = JSON.parse(
      (await e2e.invoke("post_create_draft", { draft: DRAFT, provider: "mock" })).raw!,
    ) as { draftId: string };
    const before = __mockPublisher.postCount;
    const callsBefore = __mockPublisher.publishCallCount;

    __mockPublisher.publishOutcome = "unknown";
    try {
      const res = await e2e.invoke("post_publish", {
        draftId: created.draftId,
        approval: approvalFor(DRAFT),
        provider: "mock",
        idempotencyKey: "e2e-story-g",
      });
      expect(res.ok).toBe(true);
      // The tool queried the remote status and resolved to published WITHOUT
      // issuing a second publish.
      expect(JSON.parse(res.raw!).status).toBe("published");
    } finally {
      __mockPublisher.publishOutcome = "published";
    }

    // Exactly one post was created across the whole flow, and the publish was
    // attempted exactly once (no blind resend into the idempotent mock).
    expect(__mockPublisher.postCount - before).toBe(1);
    expect(__mockPublisher.publishCallCount - callsBefore).toBe(1);
  });
});
