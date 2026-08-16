/**
 * creator-voice domain types (CREATOR-010).
 *
 * A VoiceReference is the ONLY authorized clone/transfer source. It stores
 * source, owner / permission note, checksum and createdAt — never unnecessary
 * biometric information.
 */
export interface VoiceReference {
  id: string;
  name: string;
  source: string;
  owner: string;
  authorizationNote?: string;
  checksum: string;
  createdAt: string;
}

export interface VoiceReferenceInput {
  name: string;
  source: string;
  owner: string;
  /** Mandatory: must be true to register a cloneable voice reference. */
  authorization: boolean;
  authorizationNote?: string;
}

export type VoiceProviderKind = "mock" | "openvoice";

/** Minimal info exposed by voice_list (no biometric data). */
export interface VoiceReferenceSummary {
  id: string;
  name: string;
  source: string;
  owner: string;
  checksum: string;
  createdAt: string;
}
