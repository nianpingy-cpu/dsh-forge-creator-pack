import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  lintAllSkills,
  lintSkillFile,
  SKILLS_DIR,
} from "../scripts/creator-skill-lint.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(REPO_ROOT, "tests", "fixtures", "skill-lint");

/** The full set of skills CREATOR-014 must ship. */
const REQUIRED_SKILLS: readonly string[] = [
  "topic-to-outline.md",
  "short-video-script.md",
  "platform-repurpose.md",
  "xiaohongshu-writing.md",
  "bilibili-metadata.md",
  "youtube-metadata.md",
  "creator-humanize.md",
];

describe("creator skills lint (CREATOR-014)", () => {
  it("ships all 7 required skill files", () => {
    const files = readdirSync(SKILLS_DIR)
      .filter((f) => f.endsWith(".md"))
      .sort();
    expect(files).toEqual([...REQUIRED_SKILLS].sort());
  });

  it("lintAllSkills() passes for every shipped skill", () => {
    const result = lintAllSkills();
    expect(result.ok, JSON.stringify(result.findings)).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("rejects a skill without a purpose description", () => {
    const r = lintSkillFile(join(FIXTURES, "no-purpose.md"), "no-purpose.md");
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.rule === "purpose")).toBe(true);
  });

  it("rejects a reference to an unregistered tool", () => {
    const r = lintSkillFile(
      join(FIXTURES, "unregistered-tool.md"),
      "unregistered-tool.md",
    );
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.rule === "unregistered-tool")).toBe(true);
  });

  it("rejects guidance that bypasses the publish approval flow", () => {
    const r = lintSkillFile(
      join(FIXTURES, "approval-bypass.md"),
      "approval-bypass.md",
    );
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.rule === "approval-bypass")).toBe(true);
  });

  it("rejects guidance that reads secrets directly", () => {
    const r = lintSkillFile(join(FIXTURES, "secret-read.md"), "secret-read.md");
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.rule === "secret-read")).toBe(true);
  });

  it("rejects guaranteed-traffic promises", () => {
    const r = lintSkillFile(
      join(FIXTURES, "guaranteed-traffic.md"),
      "guaranteed-traffic.md",
    );
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.rule === "guaranteed-traffic")).toBe(true);
  });
});
