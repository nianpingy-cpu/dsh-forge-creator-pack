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

/**
 * Normalize any thrown value into a CreatorError. Never propagates a raw
 * stack trace; unknown errors collapse to a stable fallback code.
 */
export function normalizeCreatorError(
  err: unknown,
  fallbackMessage = "creator operation failed",
): CreatorError {
  if (err && typeof err === "object" && "code" in err && "message" in err) {
    const candidate = err as { code: unknown; message: unknown };
    if (
      typeof candidate.code === "string" &&
      (CREATOR_ERROR_CODES as readonly string[]).includes(candidate.code)
    ) {
      return {
        code: candidate.code as CreatorErrorCode,
        message: String(candidate.message),
      };
    }
  }
  return creatorError("CREATOR_PROVIDER_UNAVAILABLE", fallbackMessage);
}
