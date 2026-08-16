import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadEcosystemMatrix,
  validateEcosystemMatrix,
  REQUIRED_CREATOR_CAPABILITIES,
} from "../scripts/creator-ecosystem-check.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("creator ecosystem & overlap lock (CREATOR-001)", () => {
  it("loads the ecosystem matrix source of truth", () => {
    // RED: docs/creator/ecosystem.json does not exist yet, so this fails.
    const entries = loadEcosystemMatrix(REPO_ROOT);
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("covers every required creator plugin capability", () => {
    const entries = loadEcosystemMatrix(REPO_ROOT);
    const capabilities = new Set(entries.map((e) => e.capability));
    for (const required of REQUIRED_CREATOR_CAPABILITIES) {
      expect(
        capabilities.has(required),
        `missing required capability row: ${required}`,
      ).toBe(true);
    }
  });

  it("validates upstream, license, integration mode and decision for every row", () => {
    const report = validateEcosystemMatrix(loadEcosystemMatrix(REPO_ROOT));
    expect(report.problems).toEqual([]);
    expect(report.valid).toBe(true);
  });

  it("rejects vendoring when social-auto-upload license is not explicit", () => {
    const entries = loadEcosystemMatrix(REPO_ROOT);
    const sau = entries.find((e) => e.capability === "social-auto-upload");
    expect(sau, "social-auto-upload row must exist").toBeDefined();
    const explicit = !/^(unclear|unknown|none|tbd|n\/a)$/i.test(sau!.license);
    if (!explicit) {
      expect(sau!.decision).toBe("DO NOT BUILD");
    }
    expect(sau!.decision).not.toBe("REUSE");
    expect(sau!.decision).not.toBe("BUILD");
  });

  it("forces adapter/provider integration for GPL/AGPL upstreams", () => {
    const entries = loadEcosystemMatrix(REPO_ROOT);
    for (const entry of entries) {
      const license = entry.license.toUpperCase();
      if (
        license.includes("GPL") ||
        license.includes("AGPL") ||
        license.includes("LGPL") ||
        license.includes("MPL")
      ) {
        const mode = entry.integrationMode.toLowerCase();
        expect(
          mode.includes("adapter") ||
            mode.includes("provider") ||
            mode.includes("external") ||
            mode.includes("no vendoring") ||
            mode.includes("no source"),
          `${entry.capability} (${entry.license}) must use adapter/provider integration`,
        ).toBe(true);
      }
    }
  });

  it("reuses the ffmpeg adapter for creator-clips", () => {
    const entries = loadEcosystemMatrix(REPO_ROOT);
    const ffmpeg = entries.find((e) => e.capability === "ffmpeg");
    expect(ffmpeg, "ffmpeg row must exist").toBeDefined();
    expect(ffmpeg!.decision).toBe("REUSE");
  });
});
