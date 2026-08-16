import { describe, expect, it, afterAll } from "vitest";
import { publishPlugin, contentHashOf } from "@dsh-forge-creator/plugin-creator-publish";
import { createApproval, type CreatorApproval, type PlatformPostDraft } from "@dsh-forge-creator/core";
import { createE2E } from "./harness.js";

const DRAFT: PlatformPostDraft = {
  platform: "youtube",
  title: "E2E publish story",
  text: "Publishing is gated behind explicit approval.",
  media: [],
  tags: ["e2e"],
};

function approvalFor(
  draft: PlatformPostDraft,
  scope: "creator-remote-publish" | "creator-remote-destructive" = "creator-remote-publish",
  ttlMs = 60_000,
): CreatorApproval {
  return createApproval(scope, contentHashOf(draft), { ttlMs });
}

/**
 * Story E — 安全发布 (safe publishing).
 *
 * draft -> preview -> blocked without approval -> approval -> mock publish ->
 * status verification. Deterministic via the mock publisher; no external
 * social accounts.
 */
describe("E2E Story E — 安全发布 (CREATOR-015)", () => {
  const e2e = createE2E([publishPlugin]);
  afterAll(() => e2e.cleanup());

  it("cannot publish without explicit approval", async () => {
    const created = await e2e.invoke("post_create_draft", {
      draft: DRAFT,
      provider: "mock",
    });
    expect(created.ok).toBe(true);
    const { draftId } = JSON.parse(created.raw!) as { draftId: string };

    const preview = await e2e.invoke("post_preview", { draft: DRAFT });
    expect(preview.ok).toBe(true);
    expect(JSON.parse(preview.raw!).text).toBe(DRAFT.text);

    // blocked without approval
    const blocked = await e2e.invoke("post_publish", {
      draftId,
      provider: "mock",
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error?.code).toBe("PermissionDenied");
  });

  it("publishes only after explicit approval and verifies status", async () => {
    const created = await e2e.invoke("post_create_draft", {
      draft: DRAFT,
      provider: "mock",
    });
    const { draftId } = JSON.parse(created.raw!) as { draftId: string };

    const published = await e2e.invoke("post_publish", {
      draftId,
      approval: approvalFor(DRAFT),
      provider: "mock",
      idempotencyKey: "e2e-story-e",
    });
    expect(published.ok).toBe(true);
    expect(JSON.parse(published.raw!).status).toBe("published");

    const status = await e2e.invoke("post_status", { draftId, provider: "mock" });
    expect(status.ok).toBe(true);
    expect(JSON.parse(status.raw!).status).toBe("published");
  });
});
