/**
 * Creator Pack ecosystem & overlap lock (CREATOR-001).
 *
 * The single upstream-decision baseline for every later CREATOR issue.
 * `docs/creator/ecosystem.json` is the machine-readable source of truth;
 * `docs/creator/ECOSYSTEM_MATRIX.md`, `UPSTREAM_LICENSES.md` and
 * `BUILD_REUSE_DECISIONS.md` are the human-facing renderings of the same data.
 *
 * Every capability row MUST record upstream, license, integration mode and an
 * overlap decision. GPL/AGPL upstreams default to adapter/provider (never
 * source copying); upstreams without an explicit license are never vendored.
 */
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type EcosystemDecision = "BUILD" | "REUSE" | "INTEGRATE" | "DO NOT BUILD";

export interface EcosystemEntry {
  /** Capability or target plugin name (e.g. creator-radar, ffmpeg). */
  capability: string;
  /** Existing DSH overlap inside this repository ("none" when absent). */
  existingDshOverlap: string;
  /** Candidate upstream project (owner/repo) or "none". */
  candidateUpstream: string;
  /** Approx. stars + date checked (e.g. "~9k, checked 2026-08-16"). */
  starsDateChecked: string;
  /** SPDX license id or "unclear" when not explicit. */
  license: string;
  /** How the upstream is integrated: API / CLI / external service / mock / adapter. */
  integrationMode: string;
  /** Overlap decision. */
  decision: EcosystemDecision;
  /** Risk note (license, scale, instability, side effects). */
  risk: string;
}

/** The ten Creator Pack target plugin capabilities required by the matrix. */
export const REQUIRED_CREATOR_CAPABILITIES: readonly string[] = [
  "creator-radar",
  "creator-capture",
  "creator-transcribe",
  "creator-clips",
  "creator-short-video",
  "creator-cover",
  "creator-voice",
  "creator-localize",
  "creator-motion",
  "creator-publish",
];

const DECISIONS: readonly EcosystemDecision[] = [
  "BUILD",
  "REUSE",
  "INTEGRATE",
  "DO NOT BUILD",
];

/**
 * Upstreams whose license must be explicitly recorded before they may be
 * vendored in any form. When the license field is "unclear", the decision
 * must be DO NOT BUILD (never vendor, never partially copy).
 */
const NO_VENDOR_UNLESS_EXPLICIT = ["social-auto-upload"];

/** Copyleft licenses that force adapter/provider integration (no copying). */
const COPYLEFT_LICENSES = ["GPL", "AGPL", "LGPL", "MPL"];

/**
 * Whether a license string counts as an explicit license. Real-world values
 * such as "none (no license file; not explicit)" or "unclear — see notes"
 * must NOT be treated as explicit (review finding #1).
 */
export function isExplicitLicense(license: string): boolean {
  const normalized = license.trim().toLowerCase();
  if (normalized === "") return false;
  if (["unclear", "unknown", "none", "tbd", "n/a"].includes(normalized)) {
    return false;
  }
  if (
    normalized.startsWith("none") ||
    normalized.startsWith("no license") ||
    normalized.startsWith("unclear") ||
    normalized.startsWith("unknown")
  ) {
    return false;
  }
  return true;
}

/**
 * Whether an integration mode is adapter/provider-safe — i.e. it cannot copy
 * upstream source into the repository.
 */
export function isAdapterSafe(mode: string): boolean {
  const normalized = mode.toLowerCase();
  return (
    normalized.includes("adapter") ||
    normalized.includes("provider") ||
    normalized.includes("external") ||
    normalized.includes("no vendoring") ||
    normalized.includes("no source")
  );
}

export interface EcosystemValidation {
  valid: boolean;
  problems: string[];
}

/**
 * Validate the ecosystem matrix. Returns every problem found; `valid` is
 * false when any problem exists.
 */
export function validateEcosystemMatrix(
  entries: readonly EcosystemEntry[],
): EcosystemValidation {
  const problems: string[] = [];

  const byCapability = new Map(entries.map((e) => [e.capability, e]));

  // 0. Duplicate capability rows are a defect (review finding #4).
  const seen = new Set<string>();
  for (const entry of entries) {
    const capability = String(entry.capability ?? "");
    if (seen.has(capability)) {
      problems.push(`duplicate capability row: ${capability}`);
    }
    seen.add(capability);
  }

  // 1. All ten target creator plugin capabilities must be present.
  for (const required of REQUIRED_CREATOR_CAPABILITIES) {
    if (!byCapability.has(required)) {
      problems.push(`missing required capability row: ${required}`);
    }
  }

  // 2. Every row records upstream, license, integration mode, decision.
  // Structurally invalid rows must produce a diagnostic, never a crash
  // (review finding #3).
  for (const entry of entries) {
    const row = `capability '${String(entry.capability ?? "")}'`;
    if (!String(entry.candidateUpstream ?? "").trim()) {
      problems.push(`${row}: missing upstream`);
    }
    if (!String(entry.license ?? "").trim()) {
      problems.push(`${row}: missing license`);
    }
    if (!String(entry.integrationMode ?? "").trim()) {
      problems.push(`${row}: missing integration mode`);
    }
    if (!DECISIONS.includes(entry.decision)) {
      problems.push(`${row}: invalid decision '${String(entry.decision)}'`);
    }
    if (!String(entry.starsDateChecked ?? "").trim()) {
      problems.push(`${row}: missing stars/date check`);
    }
    if (!String(entry.existingDshOverlap ?? "").trim()) {
      problems.push(`${row}: missing existing DSH overlap note`);
    }
    if (!String(entry.risk ?? "").trim()) {
      problems.push(`${row}: missing risk note`);
    }
  }

  // 3. Copyleft upstreams must be adapter/provider — never source copying.
  for (const entry of entries) {
    const licenseUpper = String(entry.license ?? "").toUpperCase();
    if (COPYLEFT_LICENSES.some((l) => licenseUpper.includes(l))) {
      const mode = String(entry.integrationMode ?? "").toLowerCase();
      const adapterSafe = isAdapterSafe(mode);
      if (!adapterSafe) {
        problems.push(
          `capability '${entry.capability}': ${entry.license} license requires adapter/provider integration, got '${entry.integrationMode}'`,
        );
      }
    }
  }

  // 3b. Custom / non-standard licenses (e.g. Remotion License, NOASSERTION)
  // must be adapter-safe too — never vendored (review finding #7).
  for (const entry of entries) {
    const license = String(entry.license ?? "");
    if (/NOASSERTION|custom license|remotion license/i.test(license)) {
      const mode = String(entry.integrationMode ?? "").toLowerCase();
      if (!isAdapterSafe(mode)) {
        problems.push(
          `capability '${entry.capability}': '${entry.license}' is a custom/non-standard license and must use adapter/provider integration (no vendoring), got '${entry.integrationMode}'`,
        );
      }
    }
  }

  // 4. Upstreams without an explicit license must not be vendored.
  for (const entry of entries) {
    if (NO_VENDOR_UNLESS_EXPLICIT.includes(entry.capability)) {
      const explicit = isExplicitLicense(String(entry.license ?? ""));
      if (!explicit && entry.decision !== "DO NOT BUILD") {
        problems.push(
          `capability '${entry.capability}': license '${entry.license}' is not explicit; decision must be DO NOT BUILD (no vendoring)`,
        );
      }
      if (entry.decision === "REUSE" || entry.decision === "BUILD") {
        problems.push(
          `capability '${entry.capability}': never vendor/partially copy; decision must be INTEGRATE (adapter) or DO NOT BUILD`,
        );
      }
    }
  }

  // 5. The FFmpeg capability must be REUSE (creator-clips reuses it).
  const ffmpeg = byCapability.get("ffmpeg");
  if (ffmpeg) {
    if (ffmpeg.decision !== "REUSE") {
      problems.push(
        `capability 'ffmpeg': existing adapter must be REUSE (creator-clips reuses it), got '${ffmpeg.decision}'`,
      );
    }
  } else {
    problems.push("missing required capability row: ffmpeg (existing adapter)");
  }

  return { valid: problems.length === 0, problems };
}

/** Load the ecosystem matrix from docs/creator/ecosystem.json. */
export function loadEcosystemMatrix(root: string): EcosystemEntry[] {
  const path = join(root, "docs", "creator", "ecosystem.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error(`ecosystem.json must be an array of entries, got ${typeof raw}`);
  }
  return raw as EcosystemEntry[];
}

function main(): void {
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  // Optional positional arg: repo root (defaults to repo root).
  const root = process.argv[2] ? resolve(process.argv[2]) : repoRoot;
  const entries = loadEcosystemMatrix(root);
  const report = validateEcosystemMatrix(entries);
  if (report.problems.length === 0) {
    console.log(
      `creator ecosystem matrix valid: ${entries.length} capabilities, ${REQUIRED_CREATOR_CAPABILITIES.length} required plugin rows present`,
    );
    return;
  }
  console.error(
    `creator ecosystem matrix INVALID (${report.problems.length} problem(s)):`,
  );
  for (const problem of report.problems) {
    console.error(`  - ${problem}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
