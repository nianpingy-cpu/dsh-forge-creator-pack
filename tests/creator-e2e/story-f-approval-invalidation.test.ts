import { describe, expect, it, afterAll } from "vitest";
import { publishPlugin, contentHashOf } from "@dsh-forge-creator/plugin-creator-publish";
import { createApproval, type CreatorApproval, type PlatformPostDraft } from "@dsh-forge-creator/core";
import { createE2E } from "./harness.js";

const DRAFT_A: PlatformPostDraft = {
  platform: "youtube",
  title: "Version A",
  text: "First version of the post.",
  media: [],
  tags: ["acceptance"],
};

const DRAFT_B: PlatformPostDraft = {
  platform: "youtube",
  title: "Version B",
  text: "Edited second version of the post.",
  media: [],
  tags: ["acceptance"],
};

function approvalFor(
  draft: PlatformPostDraft,
  ttlMs = 60_000,
): CreatorApproval {
  return createApproval("creator-remote-publish", contentHashOf(draft), { ttlMs });
}

/**
 * Story F — 审批失效 (approval invalidation), §30 Scenario 7.
 *
 * draft A -> approve A -> a DIFFERENT draft B -> try publish B with A's
 * approval -> BLOCKED. The approval is content-hash bound, so editing the
 * content (a different draft) invalidates the old approval. Deterministic via
 * the mock publisher.
 */
describe("E2E Story F — 审批失效 (CREATOR-016 §30 S7)", () => {
  const e2e = createE2E([publishPlugin]);
  afterAll(() => e2e.cleanup());

  it("an approval for draft A cannot publish a different draft B", async () => {
    const a = JSON.parse(
      (await e2e.invoke("post_create_draft", { draft: DRAFT_A, provider: "mock" })).raw!,
    ) as { draftId: string };
    const b = JSON.parse(
      (await e2e.invoke("post_create_draft", { draft: DRAFT_B, provider: "mock" })).raw!,
    ) as { draftId: string };
    expect(a.draftId).not.toBe(b.draftId);

    const approvalA = approvalFor(DRAFT_A);

    // Publishing A with A's own approval is allowed.
    const okA = await e2e.invoke("post_publish", {
      draftId: a.draftId,
      approval: approvalA,
      provider: "mock",
    });
    expect(okA.ok).toBe(true);
    expect(JSON.parse(okA.raw!).status).toBe("published");

    // Publishing B with A's approval is BLOCKED (content-hash mismatch).
    const blockedB = await e2e.invoke("post_publish", {
      draftId: b.draftId,
      approval: approvalA,
      provider: "mock",
    });
    expect(blockedB.ok).toBe(false);
    expect(blockedB.error?.code).toBe("PermissionDenied");
  });
});
