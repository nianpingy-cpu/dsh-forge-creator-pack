import { describe, expect, it, afterAll } from "vitest";
import { coverPlugin } from "@dsh-forge-creator/plugin-creator-cover";
import { createE2E } from "./harness.js";

interface CoverAsset {
  path: string;
  width: number;
  height: number;
  profile: string;
}

/**
 * Story D — 封面变体 (cover variants).
 *
 * base image -> platform variants -> validate. Deterministic: mock background
 * provider records exact dimensions, cover_variants produces one asset per
 * profile, cover_validate re-checks each against its platform profile.
 */
describe("E2E Story D — 封面变体 (CREATOR-015)", () => {
  const e2e = createE2E([coverPlugin]);
  afterAll(() => e2e.cleanup());
  const PROFILES = ["youtube-thumbnail", "x-image", "douyin-vertical"] as const;

  it("runs base image -> variants -> validate end to end", async () => {
    // 1. base image (mock provider records 1600x900)
    const base = await e2e.invoke("cover_generate_background", {
      outputPath: "base.png",
      width: 1600,
      height: 900,
      provider: "mock",
    });
    expect(base.ok).toBe(true);
    const baseAsset = JSON.parse(base.raw!) as CoverAsset;
    expect(baseAsset).toMatchObject({ width: 1600, height: 900, path: "base.png" });

    // 2. platform variants (one per profile)
    const variants = await e2e.invoke("cover_variants", {
      inputPath: "base.png",
      profiles: [...PROFILES],
      outputDir: "covers",
    });
    expect(variants.ok).toBe(true);
    const assets = JSON.parse(variants.raw!) as CoverAsset[];
    expect(assets.length).toBe(PROFILES.length);
    for (const a of assets) {
      expect(a.path).not.toMatch(/^https?:\/\//);
    }

    // 3. validate every variant against its own profile
    for (const a of assets) {
      const check = await e2e.invoke("cover_validate", {
        inputPath: a.path,
        profile: a.profile,
      });
      expect(check.ok, `cover_validate(${a.path} as ${a.profile}) failed`).toBe(true);
    }
  });
});
