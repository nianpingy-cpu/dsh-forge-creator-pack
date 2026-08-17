/**
 * Provider base contract (CREATOR-002).
 *
 * All creator plugins expose typed providers (mock / adapter / external) that
 * declare a capability set. Consumers check support via `providerSupports`.
 */
import type { CreatorProvider } from "./types.js";

/** Whether a provider declares support for a capability. */
export function providerSupports(
  provider: CreatorProvider,
  capability: string,
): boolean {
  return (
    !!provider &&
    typeof provider === "object" &&
    Array.isArray(provider.capabilities) &&
    provider.capabilities.includes(capability)
  );
}
