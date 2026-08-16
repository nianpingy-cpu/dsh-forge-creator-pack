/**
 * Normalized creator errors (CREATOR-002).
 *
 * Creator plugins surface typed errors with structured context — a raw
 * external stack trace is never returned to the model.
 */
import {
  CREATOR_ERROR_CODES,
  type CreatorError,
  type CreatorErrorCode,
} from "./types.js";

export function creatorError(
  code: CreatorErrorCode,
  message: string,
  context?: Record<string, unknown>,
): CreatorError {
  return { code, message, context };
}

/** Remove stack-frame lines ("    at file.ts:1:1") from a message. */
function stripStackFrames(message: string): string {
  return message
    .split("\n")
    .filter((line) => !/^\s+at\s/.test(line))
    .join("\n")
    .trim();
}

/**
 * Normalize any thrown value into a CreatorError. Never propagates a raw
 * stack trace; unknown errors collapse to a stable fallback code.
 */
export function normalizeCreatorError(
  err: unknown,
  fallbackMessage = "creator operation failed",
): CreatorError {
  if (err && typeof err === "object" && "code" in err && "message" in err) {
    const candidate = err as {
      code: unknown;
      message: unknown;
      context?: unknown;
    };
    if (
      typeof candidate.code === "string" &&
      (CREATOR_ERROR_CODES as readonly string[]).includes(candidate.code)
    ) {
      return {
        code: candidate.code as CreatorErrorCode,
        message: stripStackFrames(String(candidate.message)),
        context:
          candidate.context && typeof candidate.context === "object"
            ? (candidate.context as Record<string, unknown>)
            : undefined,
      };
    }
  }
  return creatorError("CREATOR_PROVIDER_UNAVAILABLE", fallbackMessage);
}
