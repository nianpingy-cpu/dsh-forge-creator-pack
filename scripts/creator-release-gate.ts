/**
 * Creator Pack release gate (CREATOR-016).
 *
 * The pre-tag checklist for the first public release. A tag may only be cut
 * when the gate is fully green:
 *   - docs complete (docs/creator/README + QUICKSTART + SAFETY + PROVIDERS +
 *     EXAMPLES + RELEASE_NOTES)
 *   - main README has a Creator Pack entry
 *   - security audit clean (no secrets / credentials / user paths / large media)
 *   - license & ecosystem matrix complete (reuses CREATOR-001 validator)
 *   - no tracked secret files (.env, credentials, keys)
 *   - no real social publish possible from CI (mock-only default is enforced
 *     by plugin contract tests; audit additionally confirms no credentials)
 *
 * Runnable directly: `node scripts/creator-release-gate.ts`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEcosystemMatrix, validateEcosystemMatrix } from "./creator-ecosystem-check.js";
import { securityAudit } from "./creator-security-audit.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const REQUIRED_DOCS: readonly string[] = [
  "docs/creator/README.md",
  "docs/creator/QUICKSTART.md",
  "docs/creator/SAFETY.md",
  "docs/creator/PROVIDERS.md",
  "docs/creator/EXAMPLES.md",
  "docs/creator/RELEASE_NOTES.md",
];

const SECRET_FILES: readonly string[] = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "credentials.json",
  "secrets.json",
];

export interface ReleaseGateFinding {
  rule: string;
  message: string;
}

export interface ReleaseGateResult {
  ok: boolean;
  findings: ReleaseGateFinding[];
}

/** Run the release gate; returns ok=false with findings when not releasable. */
export function runReleaseGate(root: string = ROOT): ReleaseGateResult {
  const findings: ReleaseGateFinding[] = [];

  // 1. Documentation complete.
  for (const doc of REQUIRED_DOCS) {
    if (!existsSync(join(root, doc))) {
      findings.push({ rule: "docs", message: `missing required doc: ${doc}` });
    }
  }

  // 2. Main README has a Creator Pack entry.
  try {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    if (!/## Creator Pack/i.test(readme)) {
      findings.push({
        rule: "readme",
        message: "README.md is missing the Creator Pack entry",
      });
    }
  } catch {
    findings.push({ rule: "readme", message: "README.md not readable" });
  }

  // 3. Security audit clean.
  const audit = securityAudit(root);
  if (!audit.ok) {
    findings.push({
      rule: "security",
      message: `security audit found ${audit.findings.length} issue(s): ${audit.findings
        .map((f) => `${f.file} (${f.rule})`)
        .join(", ")}`,
    });
  }

  // 4. License & ecosystem matrix complete (CREATOR-001 validator).
  try {
    const report = validateEcosystemMatrix(loadEcosystemMatrix(root));
    if (!report.valid) {
      findings.push({
        rule: "license-matrix",
        message: `ecosystem matrix invalid: ${report.problems.join("; ")}`,
      });
    }
  } catch (err) {
    findings.push({
      rule: "license-matrix",
      message: `ecosystem matrix could not be validated: ${String(err)}`,
    });
  }

  // 5. No tracked secret files.
  for (const name of SECRET_FILES) {
    if (existsSync(join(root, name))) {
      findings.push({ rule: "secrets", message: `tracked secret file present: ${name}` });
    }
  }

  // 6. No real social post from CI: the publish plugin's contract tests force
  // mock-only (an unconfigured external adapter is a ToolFailure) and the
  // security audit confirms no publish credentials are committed. Explicit
  // note, not a hard scan, because a real post requires a provider config
  // that CI never provides.

  return { ok: findings.length === 0, findings };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop() ?? "");
if (isMain) {
  const result = runReleaseGate();
  for (const f of result.findings) {
    console.error(`[release-gate] ${f.rule} :: ${f.message}`);
  }
  if (!result.ok) process.exit(1);
  console.log("[release-gate] ok: ready to tag");
}
