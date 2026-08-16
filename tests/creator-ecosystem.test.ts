import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadEcosystemMatrix,
  validateEcosystemMatrix,
  REQUIRED_CREATOR_CAPABILITIES,
  type EcosystemEntry,
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

describe("validator hardening (external review findings)", () => {
  it("treats 'none (no license file; not explicit)' as not-explicit — social-auto-upload cannot INTEGRATE", () => {
    // Regression for review finding #1: the regex-only explicit-license check
    // is blind to the real license string, which would let a future change
    // switch social-auto-upload to INTEGRATE despite the no-vendoring rule.
    const entries = loadEcosystemMatrix(REPO_ROOT);
    const mutated = entries.map((e) =>
      e.capability === "social-auto-upload"
        ? { ...e, decision: "INTEGRATE" as const }
        : e,
    );
    const report = validateEcosystemMatrix(mutated);
    expect(report.valid).toBe(false);
    expect(report.problems.join("\n")).toContain("social-auto-upload");
  });

  it("rejects a GPL row whose integration mode would vendor source", () => {
    const entries = loadEcosystemMatrix(REPO_ROOT);
    const mutated = entries.map((e) =>
      e.capability === "creator-radar"
        ? { ...e, integrationMode: "copy GPL source into the repository" }
        : e,
    );
    const report = validateEcosystemMatrix(mutated);
    expect(report.valid).toBe(false);
    expect(report.problems.join("\n")).toContain("creator-radar");
  });

  it("reports a missing license field as a problem instead of crashing", () => {
    // Regression for review finding #3: structurally invalid rows must
    // produce a diagnostic, not a TypeError.
    const entries = loadEcosystemMatrix(REPO_ROOT);
    const [head] = entries;
    // A malformed runtime row (license key missing) — cast to simulate
    // untrusted data crossing the JSON boundary.
    const broken = {
      capability: "fixture-broken",
      existingDshOverlap: head!.existingDshOverlap,
      candidateUpstream: head!.candidateUpstream,
      starsDateChecked: head!.starsDateChecked,
      integrationMode: head!.integrationMode,
      decision: "DO NOT BUILD" as const,
      risk: head!.risk,
      // license key intentionally missing
    } as unknown as EcosystemEntry;
    expect(() =>
      validateEcosystemMatrix([broken, ...entries]),
    ).not.toThrow();
    const report = validateEcosystemMatrix([broken, ...entries]);
    expect(report.valid).toBe(false);
    expect(report.problems.join("\n")).toContain("missing license");
  });

  it("detects duplicate capability rows", () => {
    // Regression for review finding #4: duplicate rows must be reported.
    const entries = loadEcosystemMatrix(REPO_ROOT);
    const duplicated = [...entries, ...entries.slice(0, 1)];
    const report = validateEcosystemMatrix(duplicated);
    expect(report.valid).toBe(false);
    expect(report.problems.join("\n")).toContain("duplicate");
  });

  it("forces adapter/provider integration for custom/non-SPDX licenses", () => {
    // Regression for review finding #7: a NOASSERTION/custom license row
    // (e.g. Remotion) must never be vendored.
    const entries = loadEcosystemMatrix(REPO_ROOT);
    const mutated = entries.map((e) =>
      e.capability === "creator-motion"
        ? { ...e, integrationMode: "bundle upstream source into the repo" }
        : e,
    );
    const report = validateEcosystemMatrix(mutated);
    expect(report.valid).toBe(false);
    expect(report.problems.join("\n")).toContain("creator-motion");
  });
});
