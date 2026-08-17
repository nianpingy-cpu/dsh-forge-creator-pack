import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const E2E_DIR = join(dirname(fileURLToPath(import.meta.url)));

/**
 * Taskbook §30 final acceptance scenarios -> the E2E story file(s) that must
 * cover them deterministically (no external accounts, no network).
 */
const SCENARIO_COVERAGE: Record<string, readonly string[]> = {
  // Scenario 1 — AI 科普选题: top 3 topics + evidence + opportunity score.
  "scenario-1-topic-research": ["story-a-research"],
  // Scenario 2 — 授权素材到字幕: inspect -> rights -> capture -> transcribe -> SRT.
  "scenario-2-capture-transcribe": ["story-a-research", "story-b-short-video"],
  // Scenario 3 — 长视频转竖屏: fixture -> transcript -> clip 2-5s -> 9:16 -> validate.
  "scenario-3-long-to-vertical": ["story-b-short-video"],
  // Scenario 4 — 封面多平台适配: base -> youtube/bilibili/xiaohongshu -> validate.
  "scenario-4-cover-variants": ["story-d-cover"],
  // Scenario 5 — 本地化: SRT -> translate -> align -> mock TTS -> localized asset.
  "scenario-5-localize": ["story-c-localize"],
  // Scenario 6 — 安全发布: draft -> preview -> blocked -> approve -> publish -> status.
  "scenario-6-safe-publish": ["story-e-publish"],
  // Scenario 7 — 审批失效: approve draft A; publish different draft B with A's
  // approval -> BLOCKED.
  "scenario-7-approval-invalidation": ["story-f-approval-invalidation"],
  // Scenario 8 — 重试幂等: publish -> status unknown -> query -> already
  // published -> DO NOT publish again.
  "scenario-8-retry-idempotency": ["story-g-retry-idempotency"],
};

describe("creator final acceptance coverage (§30, CREATOR-016)", () => {
  it("covers all 8 taskbook scenarios with E2E stories", () => {
    const files = readdirSync(E2E_DIR).filter((f) => f.endsWith(".test.ts"));
    const missing: string[] = [];
    for (const [scenario, stories] of Object.entries(SCENARIO_COVERAGE)) {
      for (const story of stories) {
        if (!files.includes(`${story}.test.ts`)) {
          missing.push(`${scenario} -> ${story}.test.ts`);
        }
      }
    }
    expect(missing, `missing E2E coverage:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every §30 scenario is mapped", () => {
    // 8 scenarios, each mapped to at least one story.
    const scenarios = Object.keys(SCENARIO_COVERAGE);
    expect(scenarios.length).toBe(8);
    for (const [scenario, stories] of Object.entries(SCENARIO_COVERAGE)) {
      expect(stories.length, scenario).toBeGreaterThan(0);
    }
  });
});
