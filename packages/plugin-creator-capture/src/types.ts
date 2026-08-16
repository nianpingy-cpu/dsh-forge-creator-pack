/**
 * creator-capture domain types (CREATOR-005).
 */
import type { CreatorAsset } from "@dsh-forge-creator/core";

export type CaptureKind = "media" | "audio" | "subtitle" | "thumbnail";

export type ConflictPolicy = "fail" | "rename" | "overwrite-approved";

/**
 * A fully-resolved download request. `outputPath` is already canonicalized
 * inside the workspace. Only these known fields are ever read — no arbitrary
 * extra args can reach the generated argv.
 */
export interface DownloadSpec {
  sourceUrl: string;
  outputPath: string;
  kind: CaptureKind;
  conflict: ConflictPolicy;
  playlistLimit?: number;
  subtitleLang?: string;
  format?: string;
  dryRun?: boolean;
}

export interface RightsConfirmation {
  status: "owned" | "licensed" | "public-domain" | "permission-confirmed";
  sourceUrl?: string;
  attribution?: string;
  note?: string;
}

export interface CaptureOutcome {
  /** Final output path (after conflict resolution / rename). */
  outputPath: string;
  /** Generated argv (dry-run) or undefined when executed. */
  argv?: string[];
  asset: CreatorAsset;
}
