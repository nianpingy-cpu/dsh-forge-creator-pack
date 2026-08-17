# PR #18 Review — CREATOR-009 creator-cover

Independent external model review (non-implementer). One round + NB cleanup.

## Round 1 — APPROVE
- **Centralized platform config**: all 6 required profiles (youtube-thumbnail,
  bilibili-cover, xiaohongshu-portrait, douyin-vertical, wechat-article-cover,
  x-image) with width/height/safeArea/limits + a `source` note in `platforms.ts`;
  no scattered dimension literals in tools; unknown profile -> InvalidArguments.
- **Layout engine**: LocalLayoutProvider places title/subject in the safe area,
  detects text overflow (char limit + deterministic physical fit) and
  safe-area violations, and falls back to a supported font (fontFallback flag).
- **Providers**: MockCoverProvider records dimensions deterministically;
  ComfyUIProvider is an external HTTP/API adapter ONLY (GPL-3.0 upstream, no
  vendoring; unconfigured -> typed ToolFailure "not configured").
- **Store**: pre-seeded `fixture.png` (1600x900) makes stateless cover_validate
  checks deterministic; cover_variants -> validate -> CreatorAsset[] acceptance
  verified.
- **Tools**: all 7 tools correct mutationClass; every path workspace-bounded
  via assertCreatorAssetInWorkspace; permission gate on all workspace-write
  tools; cover_validate returns typed diagnostics on mismatch/unknown; no
  external URLs/credentials; no shell/binary execution (no ctx.run).
- **RED tests discriminating** (verified fail on stub); TDD history verified
  (88da68c RED -> e3030b8 GREEN).
- **Gates green (run by reviewer)**: typecheck 0, lint 0, full suite 349/16,
  cover 21/21.
- **License clean**: ComfyUI GPL-3.0 handled as adapter-only, no vendoring,
  metadata discloses upstream.
- Non-blocking: NB-1 hardcoded background default (fixed: derived from
  youtube-thumbnail profile); NB-2 free-form `style` mock hint (accepted —
  passive, documented); NB-3 store keyed by relative path (documented
  limitation + follow-up); NB-4 TDD purity (layout engine predated its RED
  tests; stubs still made all 21 tests fail).
- Final merge recommendation (Round 1): **Merge**.

## NB cleanup applied before merge
- NB-1: background default dimensions now derived from the youtube-thumbnail
  profile (no scattered literals).
- NB-3: documented the relative-path keying limitation in `store.ts`.

## Evidence
- RED (`88da68c`): 21 fail (all 7 tool stubs throw "not implemented")
- GREEN (`e3030b8`): 21 pass
- NB cleanup (`1411cf4`): 21 pass
- Final: 21 cover tests; full suite 349; typecheck 0; lint 0; CI green.
- Merge commit: `c081d60` (PR #18)
