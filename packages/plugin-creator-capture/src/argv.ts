/**
 * creator-capture argv builders (CREATOR-005).
 *
 * RED: builders are stubs — they throw "not implemented". Tests are failing.
 * GREEN emits typed argv[] only (never a shell string), reads only known
 * fields, and encodes the explicit conflict policy + playlist limit.
 */
import type { DownloadSpec } from "./types.js";

export type ArgvResult = { ok: true; argv: string[] } | { ok: false; errors: string[] };

function notImplemented(name: string): never {
  throw new Error(`not implemented: ${name}`);
}

/**
 * Build the typed argv[] for a download. Rejects unknown kinds/conflicts,
 * never appends arbitrary extra args, and encodes the conflict policy.
 */
export function buildDownloadArgv(_spec: DownloadSpec): ArgvResult {
  return notImplemented("buildDownloadArgv");
}

/** Build the typed argv[] for `media_inspect` (yt-dlp -J). */
export function buildInspectArgv(_sourceUrl: string): string[] {
  return notImplemented("buildInspectArgv");
}

/** Build the typed argv[] for `media_formats` (yt-dlp -J --list-formats). */
export function buildFormatsArgv(_sourceUrl: string): string[] {
  return notImplemented("buildFormatsArgv");
}

/**
 * Build the typed argv[] for `playlist_inspect` / `playlist_download`
 * (flat playlist, bounded by the playlist limit).
 */
export function buildPlaylistArgv(
  _sourceUrl: string,
  _outputPath: string,
  _limit?: number,
  _download = false,
): string[] {
  return notImplemented("buildPlaylistArgv");
}
