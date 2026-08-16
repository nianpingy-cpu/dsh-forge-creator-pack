# PR #24 Review — CREATOR-012 creator-motion

Independent external model review (non-implementer). One round + NB comment.

## Round 1 — APPROVE
- **License gate (Remotion) satisfied**: UPSTREAM_LICENSES.md records the
  implementation-time re-check (2026-08-16): Remotion License is custom
  (NOASSERTION); conclusion: NO vendoring, generic Remotion-compatible
  HTTP/command provider + fully-local deterministic mock renderer, CI uses
  mock only. Grep confirms no Remotion source/dependency; metadata.upstreamTool
  discloses the custom license.
- **Template metadata + input schema**: 3 fixture templates (intro-card,
  lower-thirds, outro-card) carry id/name/aspectRatios/inputSchema/
  estimatedDuration/engine; validateTemplateInput enforces required fields,
  types, and rejects unknown fields.
- **Tools**: all 5 tools correct mutationClass; unknown template ->
  InvalidArguments; aspect ratio validated; render-timeout budget
  (timeoutMs < estimatedDuration*1000 -> typed Timeout, documented
  deterministic interpretation for mock-only); motion_render_variants rejects
  duplicate ratios (collision), produces distinct per-ratio paths + metadata;
  workspace boundary + permission gates; preview is local-only.
- **Provider design**: MockMotionProvider fully-local/deterministic;
  RemotionProvider generic external adapter (unconfigured -> typed
  ToolFailure). No vendoring.
- **RED tests discriminating** (all 6 mandated scenarios); TDD history verified
  (1655812 RED -> f88aa95 GREEN).
- **Gates green (run by reviewer)**: typecheck 0, lint 0, full suite 392/19,
  motion 14/14, CI verify + creator contract pass.
- Non-blocking: NB-1 TDD purity (templates/providers in RED commit); NB-2
  license re-verify network-blocked (honest, conservative, outcome correct);
  NB-3 canonical path discarded (comment added); NB-4 timeout is a budget
  heuristic (documented, acceptable for mock).
- Final merge recommendation (Round 1): **Merge**.

## NB cleanup applied before merge
- NB-3: documented the canonical-path binding requirement in
  `resolveWorkspacePath` for a future real renderer.

## Evidence
- RED (`1655812`): 14 fail (all 5 tool stubs throw "not implemented")
- GREEN (`f88aa95`): 14 pass
- NB cleanup (`6eb6409`): 14 pass
- Final: 14 motion tests; full suite 392; typecheck 0; lint 0; CI green.
- Merge commit: `ee1cb3d` (PR #24)
