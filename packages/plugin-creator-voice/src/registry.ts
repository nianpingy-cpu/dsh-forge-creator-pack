/**
 * creator-voice reference registry (CREATOR-010).
 *
 * In-memory store of authorized voice references. A reference is the only
 * legal clone/transfer source; a bare celebrity/person name can never be
 * used without a registered authorized reference.
 */
import { createHash } from "node:crypto";
import type { VoiceReference, VoiceReferenceInput } from "./types.js";

const references = new Map<string, VoiceReference>();
let counter = 0;

function checksumOf(input: VoiceReferenceInput): string {
  return createHash("sha256")
    .update(`${input.name}:${input.source}:${input.owner}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Register an authorized voice reference. Requires `authorization: true`;
 * returns undefined otherwise (the caller maps it to a typed failure).
 */
export function registerReference(
  input: VoiceReferenceInput,
): VoiceReference | undefined {
  if (input.authorization !== true) return undefined;
  counter += 1;
  const reference: VoiceReference = {
    id: `voice-${counter}`,
    name: input.name.trim(),
    source: input.source.trim(),
    owner: input.owner.trim(),
    authorizationNote: input.authorizationNote?.trim() || undefined,
    checksum: checksumOf(input),
    createdAt: new Date().toISOString(),
  };
  references.set(reference.id, reference);
  return reference;
}

export function getReference(id: string): VoiceReference | undefined {
  return references.get(id);
}

export function listReferences(): VoiceReference[] {
  return [...references.values()];
}
