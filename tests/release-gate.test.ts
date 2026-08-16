import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runReleaseGate,
  REQUIRED_DOCS,
} from "../scripts/creator-release-gate.js";
import { securityAudit } from "../scripts/creator-security-audit.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("creator release gate (CREATOR-016)", () => {
  it("passes the full release gate (docs, README entry, security audit, license matrix)", () => {
    const gate = runReleaseGate();
    expect(gate.ok, JSON.stringify(gate.findings)).toBe(true);
    expect(gate.findings).toEqual([]);
  });

  it("flags every required doc that is missing on disk", () => {
    const gate = runReleaseGate();
    const docsFindings = gate.findings.filter((f) => f.rule === "docs");
    for (const doc of REQUIRED_DOCS) {
      if (!existsSync(join(REPO_ROOT, doc))) {
        expect(
          docsFindings.some((f) => f.message.includes(doc)),
          `gate should flag missing doc ${doc}`,
        ).toBe(true);
      }
    }
  });

  it("security audit is clean", () => {
    const audit = securityAudit();
    expect(audit.ok, JSON.stringify(audit.findings)).toBe(true);
    expect(audit.findings).toEqual([]);
  });
});
