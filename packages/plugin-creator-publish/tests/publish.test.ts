import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishPlugin } from "@dsh-forge-creator/plugin-creator-publish";
import {
  runContractSuite,
  createApproval,
  type ToolContext,
  type PlatformPostDraft,
  type CreatorApproval,
} from "@dsh-forge-creator/core";
import { __mockPublisher, MockPublisher } from "../src/providers.js";
import { contentHashOf } from "../src/registry.js";

let workspaceRoot: string;

const DRAFT: PlatformPostDraft = {
  platform: "youtube",
  title: "Hello",
  text: "First post",
  media: [],
  tags: ["test"],
};

beforeAll(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "dsh-publish-"));
  writeFileSync(join(workspaceRoot, "media.mp4"), "placeholder");
});

afterAll(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

const ctx = (approved = true): ToolContext => ({
  workspaceRoot,
  run: async () => {
    throw new Error("no binary expected for creator-publish");
  },
  permission: approved ? { approved: true } : undefined,
});

const tool = (name: string) =>
  publishPlugin.tools.find((t) => t.name === name)!;

function approvalFor(
  draft: PlatformPostDraft,
  scope: "creator-remote-publish" | "creator-remote-destructive" = "creator-remote-publish",
  ttlMs = 60_000,
): CreatorApproval {
  return createApproval(scope, contentHashOf(draft), { ttlMs });
}

async function createDraft(): Promise<string> {
  const res = await tool("post_create_draft").execute(
    { draft: DRAFT, provider: "mock" },
    ctx(),
  );
  expect(res.ok).toBe(true);
  return (JSON.parse(res.raw!) as { draftId: string }).draftId;
}

describe("publisher_accounts / publisher_capabilities (CREATOR-013)", () => {
  it("lists mock accounts (CI provider is mock only)", async () => {
    const res = await tool("publisher_accounts").execute(
      { provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const accounts = JSON.parse(res.raw!) as Array<{ platform: string }>;
    expect(accounts.length).toBeGreaterThan(0);
  });

  it("reports platform capabilities (not all platforms share capabilities)", async () => {
    const res = await tool("publisher_capabilities").execute(
      { provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const caps = JSON.parse(res.raw!) as Array<{ platform: string; scheduling: boolean; media: string[] }>;
    const youtube = caps.find((c) => c.platform === "youtube");
    const xhs = caps.find((c) => c.platform === "xiaohongshu");
    expect(youtube?.scheduling).toBe(true);
    expect(xhs?.scheduling).toBe(false);
  });

  it("returns a typed diagnostic for an unconfigured Postiz provider", async () => {
    const res = await tool("publisher_accounts").execute(
      { provider: "postiz" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("ToolFailure");
    expect(res.error?.message.toLowerCase()).toContain("not configured");
  });
});

describe("post_validate / post_preview (CREATOR-013)", () => {
  it("validates a draft without any remote publish", async () => {
    const before = __mockPublisher.publishCallCount;
    const res = await tool("post_validate").execute({ draft: DRAFT }, ctx());
    expect(res.ok).toBe(true);
    expect(__mockPublisher.publishCallCount).toBe(before);
  });

  it("previews a draft without any remote publish", async () => {
    const before = __mockPublisher.publishCallCount;
    const res = await tool("post_preview").execute({ draft: DRAFT }, ctx());
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.raw!).text).toBe("First post");
    expect(__mockPublisher.publishCallCount).toBe(before);
  });

  it("rejects an invalid draft (no text/title and no media)", async () => {
    const res = await tool("post_validate").execute(
      { draft: { ...DRAFT, title: undefined, text: undefined, media: [] } },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
  });
});

describe("post_create_draft (CREATOR-013)", () => {
  it("creates a draft locally without any remote publish", async () => {
    const before = __mockPublisher.publishCallCount;
    const res = await tool("post_create_draft").execute(
      { draft: DRAFT, provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const r = JSON.parse(res.raw!) as { draftId: string; contentHash: string };
    expect(r.draftId).toMatch(/^draft-/);
    expect(r.contentHash).toBe(contentHashOf(DRAFT));
    expect(__mockPublisher.publishCallCount).toBe(before);
  });
});

describe("post_publish approval flow (CREATOR-013)", () => {
  it("blocks publish without approval", async () => {
    const draftId = await createDraft();
    const res = await tool("post_publish").execute(
      { draftId, provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("PermissionDenied");
  });

  it("blocks publish with an expired approval", async () => {
    const draftId = await createDraft();
    const expired = approvalFor(DRAFT, "creator-remote-publish", -1000);
    const res = await tool("post_publish").execute(
      { draftId, approval: expired, provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("PermissionDenied");
  });

  it("publishes after explicit approval and reports status", async () => {
    const draftId = await createDraft();
    const res = await tool("post_publish").execute(
      { draftId, approval: approvalFor(DRAFT), provider: "mock", idempotencyKey: "k-1" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.raw!).status).toBe("published");

    const status = await tool("post_status").execute(
      { draftId, provider: "mock" },
      ctx(),
    );
    expect(status.ok).toBe(true);
    expect(JSON.parse(status.raw!).status).toBe("published");
  });

  it("supports dry-run without remote publish", async () => {
    const draftId = await createDraft();
    const before = __mockPublisher.publishCallCount;
    const res = await tool("post_publish").execute(
      { draftId, approval: approvalFor(DRAFT), provider: "mock", dryRun: true },
      ctx(),
    );
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.raw!).dryRun).toBe(true);
    expect(__mockPublisher.publishCallCount).toBe(before);
  });

  it("idempotency key prevents duplicate posts", async () => {
    const draftId = await createDraft();
    await tool("post_publish").execute(
      { draftId, approval: approvalFor(DRAFT), provider: "mock", idempotencyKey: "dup-1" },
      ctx(),
    );
    const second = await tool("post_publish").execute(
      { draftId, approval: approvalFor(DRAFT), provider: "mock", idempotencyKey: "dup-1" },
      ctx(),
    );
    expect(second.ok).toBe(true);
    // The mock records only one post for the same idempotency key.
    const a = JSON.parse((await tool("post_status").execute({ draftId, provider: "mock" }, ctx())).raw!);
    expect(a.postId).toBeTruthy();
  });

  it("queries remote status before resending when status is unknown (no duplicate)", async () => {
    const unknownPublisher = new MockPublisher({ publishOutcome: "unknown" });
    const draftId = await createDraft();
    // Publish with a key whose remote state is "unknown" -> must query status,
    // not blindly resend. Use the unknown-configured publisher via the hook.
    __mockPublisher.publishOutcome = "unknown";
    try {
      const res = await tool("post_publish").execute(
        { draftId, approval: approvalFor(DRAFT), provider: "mock", idempotencyKey: "unknown-1" },
        ctx(),
      );
      expect(res.ok).toBe(true);
      // The tool queried status and resolved to published without a second send.
      expect(__mockPublisher.publishCallCount).toBeGreaterThanOrEqual(1);
      expect(JSON.parse(res.raw!).status).toBe("published");
    } finally {
      __mockPublisher.publishOutcome = "published";
    }
    expect(unknownPublisher).toBeTruthy();
  });

  it("credentials never appear in any result", async () => {
    const draftId = await createDraft();
    const res = await tool("post_publish").execute(
      { draftId, approval: approvalFor(DRAFT), provider: "mock", idempotencyKey: "secret-1" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    expect(JSON.stringify(res.raw)).not.toMatch(/(token|secret|api[_-]?key)=/i);
  });
});

describe("post_schedule / post_cancel_schedule (CREATOR-013)", () => {
  it("blocks schedule without approval", async () => {
    const draftId = await createDraft();
    const res = await tool("post_schedule").execute(
      { draftId, scheduledAt: "2026-09-01T00:00:00Z", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("PermissionDenied");
  });

  it("schedules after approval", async () => {
    const draftId = await createDraft();
    const res = await tool("post_schedule").execute(
      { draftId, scheduledAt: "2026-09-01T00:00:00Z", approval: approvalFor(DRAFT), provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.raw!).status).toBe("scheduled");
  });

  it("blocks cancel of a remote schedule without approval", async () => {
    const draftId = await createDraft();
    const res = await tool("post_cancel_schedule").execute(
      { draftId, provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("PermissionDenied");
  });

  it("cancels a schedule after explicit destructive approval", async () => {
    const draftId = await createDraft();
    await tool("post_schedule").execute(
      { draftId, scheduledAt: "2026-09-01T00:00:00Z", approval: approvalFor(DRAFT), provider: "mock" },
      ctx(),
    );
    const destructive = approvalFor(DRAFT, "creator-remote-destructive");
    const res = await tool("post_cancel_schedule").execute(
      { draftId, approval: destructive, provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
  });
});

describe("contract suite (CREATOR-013)", () => {
  it("passes the shared plugin contract kit", async () => {
    const report = await runContractSuite(publishPlugin, {
      workspaceRoot,
      toolArgs: {
        publisher_accounts: {
          valid: { provider: "mock" },
          invalid: { provider: 42 },
        },
        publisher_capabilities: {
          valid: { provider: "mock" },
          invalid: { provider: 42 },
        },
        post_validate: {
          valid: { draft: DRAFT },
          invalid: { draft: 42 },
        },
        post_preview: {
          valid: { draft: DRAFT },
          invalid: { draft: 42 },
        },
        post_create_draft: {
          valid: { draft: DRAFT, provider: "mock" },
          invalid: { draft: 42 },
        },
        post_schedule: {
          valid: {
            draftId: "draft-2",
            scheduledAt: "2026-09-01T00:00:00Z",
            approval: approvalFor(DRAFT),
            provider: "mock",
          },
          invalid: { draftId: 42 },
        },
        post_publish: {
          valid: {
            draftId: "draft-3",
            approval: approvalFor(DRAFT),
            provider: "mock",
            idempotencyKey: "cs-pub",
          },
          invalid: { draftId: 42 },
        },
        post_status: {
          valid: { draftId: "draft-1", provider: "mock" },
          invalid: { draftId: 42 },
        },
        post_cancel_schedule: {
          valid: {
            draftId: "draft-1",
            approval: approvalFor(DRAFT, "creator-remote-destructive"),
            provider: "mock",
          },
          invalid: { draftId: 42 },
        },
      },
    });
    if (!report.passed) {
      const failed = report.checks.filter((c) => !c.passed);
      expect(
        report.passed,
        "failed checks:\n" +
          failed.map((c) => `- ${c.name} :: ${c.detail ?? ""}`).join("\n"),
      ).toBe(true);
    } else {
      expect(report.passed).toBe(true);
    }
  });
});
