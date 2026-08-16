# PR #20 Review — CREATOR-010 creator-voice

Independent external model review (non-implementer). One round + NB comment.

## Round 1 — APPROVE
- **Mandatory authorization**: `voice_register_reference` requires
  `authorization: true` (rejects false AND missing); registry stores only
  source/owner/authorizationNote/checksum/createdAt — NO biometric data.
- **No impersonation bypass**: voice_clone / voice_style_transfer /
  tts_generate (with voice) all require a registered authorized reference; a
  bare celebrity/person name (e.g. "Some Celebrity") is rejected. Registry ids
  are auto-assigned (`voice-N`), so no forge/collision path. Defense in depth:
  core `assertVoiceAuthorization` re-checks the resolved reference.
- **Workspace boundary**: all outputs through assertCreatorAssetInWorkspace ->
  WorkspaceViolation; workspace-write tools gate on permission approval.
- **Secret redaction**: `redactCredentials` applied at every model-visible
  surface (register/list/preview/generate); URL-embedded credentials
  (`https://user:supersecret@host/...`) redacted to `***@` (verified).
- **Provider design**: MockVoiceProvider deterministic (synthetic only,
  CI-safe); OpenVoiceProvider external adapter only (no vendored source,
  typed ToolFailure "not configured").
- **RED tests discriminating** (all 5 mandated scenarios); TDD history verified
  (f409c26 RED -> f5b299a GREEN).
- **Gates green (run by reviewer)**: typecheck 0, lint 0, full suite 365/17,
  voice 16/16.
- **License clean**: MIT plugin; OpenVoice external adapter only, upstream
  disclosed in metadata.
- Non-blocking: NB-1 canonical path discarded (comment added for future real
  provider); NB-2 query-string secrets out of scope (URL-userinfo covered);
  NB-3 in-memory registry (accepted); NB-4 seeded voice-1 always present
  (synthetic, documented).
- Final merge recommendation (Round 1): **Merge**.

## NB cleanup applied before merge
- NB-1: documented the canonical-path binding requirement in `resolveOutputPath`
  for the future real OpenVoice adapter.

## Evidence
- RED (`f409c26`): 16 fail (all 6 tool stubs throw "not implemented")
- GREEN (`f5b299a`): 16 pass
- NB cleanup (`7fdb53b`): 16 pass
- Final: 16 voice tests; full suite 365; typecheck 0; lint 0; CI green.
- Merge commit: `258bbbd` (PR #20)
