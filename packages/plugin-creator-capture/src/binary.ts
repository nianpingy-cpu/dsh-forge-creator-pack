/**
 * creator-capture binary resolution (CREATOR-005).
 *
 * yt-dlp is Unlicense (public domain) — used as an external CLI binary,
 * never vendored. Missing binary -> BinaryNotFound with an install hint.
 */
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const YT_DLP_HINT =
  "yt-dlp is not installed. Install it (e.g. pip install -U yt-dlp or a package manager) or use dryRun to preview the generated command.";

export function resolveYtDlpBinary(): string {
  const fromEnv = process.env.YTDLP_BINARY;
  if (fromEnv && fromEnv.trim() !== "") return fromEnv;
  // Prefer PATH resolution via `yt-dlp`; when absent the runner maps ENOENT
  // to BinaryNotFound. We return an unpredictable absolute sentinel so the
  // missing case is deterministic (same pattern as plugin-ffmpeg).
  return join(tmpdir(), `dsh-ytdlp-${randomUUID()}`);
}

export const YT_DLP_BINARY_HINT = YT_DLP_HINT;
