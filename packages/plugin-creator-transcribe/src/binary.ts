/**
 * creator-transcribe binary resolution (CREATOR-006).
 *
 * Whisper is MIT (external model/binary provider; no vendoring). Missing
 * binary -> BinaryNotFound with an install hint (never a stack trace).
 */
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const WHISPER_HINT =
  "whisper is not installed. Install it (e.g. pip install openai-whisper or faster-whisper) or use the built-in mock provider for deterministic CI transcription.";

export function resolveWhisperBinary(): string {
  const fromEnv = process.env.WHISPER_BINARY;
  if (fromEnv && fromEnv.trim() !== "") return fromEnv;
  return join(tmpdir(), `dsh-whisper-${randomUUID()}`);
}

export const WHISPER_BINARY_HINT = WHISPER_HINT;
