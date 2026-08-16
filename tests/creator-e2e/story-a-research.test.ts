import { describe, expect, it, afterAll } from "vitest";
import { radarPlugin } from "@dsh-forge-creator/plugin-creator-radar";
import { capturePlugin } from "@dsh-forge-creator/plugin-creator-capture";
import { createE2E } from "./harness.js";

interface CreatorTopic {
  id: string;
  title: string;
  source: string;
  evidence: unknown[];
}

/**
 * Story A — 热点到素材 (hot topic to assets).
 *
 * fixture trend -> opportunity rank -> select source -> inspect media ->
 * authorized capture. Fully deterministic via the radar mock source and the
 * canned media runner (no external accounts, no network).
 */
describe("E2E Story A — 热点到素材 (CREATOR-015)", () => {
  const e2e = createE2E([radarPlugin, capturePlugin]);
  afterAll(() => e2e.cleanup());

  it("runs trend -> rank -> inspect -> authorized capture end to end", async () => {
    // 1. fixture trend
    const trends = await e2e.invoke("trend_fetch", { source: "mock" });
    expect(trends.ok).toBe(true);
    const topics = JSON.parse(trends.raw!) as CreatorTopic[];
    expect(topics.length).toBeGreaterThan(0);
    expect(topics[0]).toHaveProperty("id");

    // 2. opportunity rank (evidence-backed, no fabricated freshness)
    const ranked = await e2e.invoke("opportunity_rank", {});
    expect(ranked.ok).toBe(true);
    const rankedTopics = JSON.parse(ranked.raw!) as CreatorTopic[];
    expect(rankedTopics.length).toBeGreaterThan(0);
    expect(rankedTopics.length).toBeLessThanOrEqual(3);

    // 3. select a source for capture
    const selected = rankedTopics[0]!;
    const sourceUrl = "https://example.invalid/video/" + selected.id;

    // 4. inspect media (ffprobe via the canned runner)
    const inspected = await e2e.invoke("media_inspect", { sourceUrl });
    expect(inspected.ok).toBe(true);
    const info = JSON.parse(inspected.raw!) as { format?: string };
    expect(info).toBeDefined();

    // 5. authorized capture (workspace-write requires approval)
    const captured = await e2e.invoke("media_download", {
      sourceUrl,
      outputPath: "capture.mp4",
      rights: { status: "owned" },
      conflict: "fail",
    });
    expect(captured.ok).toBe(true);
    const asset = JSON.parse(captured.raw!) as { path: string };
    expect(asset.path.split(/[\\/]/).pop()).toBe("capture.mp4");
  });

  it("blocks capture without approval (safety gate in the story)", async () => {
    const denied = await e2e.invoke(
      "media_download",
      {
        sourceUrl: "https://example.invalid/v",
        outputPath: "no.mp4",
        rights: { status: "owned" },
        conflict: "fail",
      },
      { approved: false },
    );
    expect(denied.ok).toBe(false);
    expect(denied.error?.code).toBe("PermissionDenied");
  });
});
