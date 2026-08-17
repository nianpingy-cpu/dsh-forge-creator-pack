/**
 * creator-capture argv builders (CREATOR-005).
 *
 * GREEN: typed argv[] only (never a shell string). Only known spec fields are
 * read — arbitrary extra args can never reach the generated argv. Conflict
 * policy and playlist limit are encoded explicitly.
 */
import { join } from "node:path";
import type { CaptureKind, ConflictPolicy, DownloadSpec } from "./types.js";

export type ArgvResult =
  | { ok: true; argv: string[] }
  | { ok: false; errors: string[] };

const KINDS: readonly CaptureKind[] = [
  "media",
  "audio",
  "subtitle",
  "thumbnail",
];
const CONFLICTS: readonly ConflictPolicy[] = [
  "fail",
  "rename",
  "overwrite-approved",
];

function validateDownloadSpec(spec: DownloadSpec): string[] {
  const errors: string[] = [];
  if (typeof spec.sourceUrl !== "string" || spec.sourceUrl.trim() === "") {
    errors.push("sourceUrl is required");
  }
  if (typeof spec.outputPath !== "string" || spec.outputPath.trim() === "") {
    errors.push("outputPath is required");
  }
  if (!KINDS.includes(spec.kind)) {
    errors.push(`invalid kind: ${String(spec.kind)}`);
  }
  if (!CONFLICTS.includes(spec.conflict)) {
    errors.push(`invalid conflict: ${String(spec.conflict)}`);
  }
  return errors;
}

/**
 * Build the typed argv[] for a download. Rejects unknown kinds/conflicts,
 * never appends arbitrary extra args, and encodes the conflict policy.
 */
export function buildDownloadArgv(spec: DownloadSpec): ArgvResult {
  const errors = validateDownloadSpec(spec);
  if (errors.length > 0) return { ok: false, errors };
  const argv: string[] = [spec.sourceUrl];
  argv.push("-o", spec.outputPath);
  switch (spec.conflict) {
    case "fail":
    case "rename":
      argv.push("--no-overwrites");
      break;
    case "overwrite-approved":
      argv.push("--force-overwrites");
      break;
  }
  if (spec.kind === "audio") {
    argv.push("-x", "--audio-format", spec.format ?? "mp3");
  } else if (spec.kind === "subtitle") {
    argv.push(
      "--write-subs",
      "--sub-lang",
      spec.subtitleLang ?? "en",
      "--skip-download",
    );
  } else if (spec.kind === "thumbnail") {
    argv.push("--write-thumbnail", "--skip-download");
  } else if (spec.format) {
    argv.push("--format", spec.format);
  }
  if (spec.playlistLimit !== undefined && spec.playlistLimit > 0) {
    argv.push("--playlist-items", `1-${spec.playlistLimit}`);
  }
  argv.push("--no-playlist");
  return { ok: true, argv };
}

/** Build the typed argv[] for `media_inspect` (yt-dlp -J). */
export function buildInspectArgv(sourceUrl: string): string[] {
  return [sourceUrl, "-J", "--no-playlist"];
}

/** Build the typed argv[] for `media_formats` (yt-dlp -F). */
export function buildFormatsArgv(sourceUrl: string): string[] {
  return [sourceUrl, "-F", "--no-playlist"];
}

/**
 * Build the typed argv[] for `playlist_inspect` / `playlist_download`
 * (flat playlist, bounded by the playlist limit).
 */
export function buildPlaylistArgv(
  sourceUrl: string,
  outputPath: string,
  limit?: number,
  download = false,
  conflict?: ConflictPolicy,
): string[] {
  const argv: string[] = [sourceUrl];
  if (download) {
    // Static yt-dlp output template; the directory is workspace-canonicalized
    // by the caller. yt-dlp sanitizes filenames derived from media metadata.
    argv.push("-o", join(outputPath, "%(playlist_index)s-%(title)s.%(ext)s"));
  }
  if (limit !== undefined && limit > 0) {
    argv.push("--playlist-items", `1-${limit}`);
  }
  if (download) {
    if (conflict === "overwrite-approved") {
      argv.push("--force-overwrites");
    } else {
      argv.push("--no-overwrites");
    }
  }
  argv.push("--flat-playlist");
  if (!download) argv.push("-J");
  return argv;
}

