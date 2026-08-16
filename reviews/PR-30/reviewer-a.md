# Reviewer A — PR #30 (CREATOR-015 Presets + E2E Stories)

- PR: https://github.com/nianpingy-cpu/dsh-forge-creator-pack/pull/30
- Base → head: `release/v0.1.0` → `V0.1.0/issue-029-presets-e2e`
- Reviewer: independent external model (runSubagent), research-only, empirical
  verification against the local checkout.
- Result: **APPROVE** (no blocking findings).

## Verified

1. `pnpm exec vitest run presets/presets/tests/presets.test.ts tests/creator-e2e`
   → 16/16 pass; `pnpm typecheck`/`pnpm lint`/`pnpm test` all green (435 tests /
   27 files).
2. Presets match the taskbook exactly (plugin package sets via metadata.name,
   skill slugs match the 7 skills on disk, creator-full = all 11 plugins with
   no duplicates). Composition-only — no plugin code duplicated.
3. All 19 tool names invoked by the stories exist in real plugin sources; no
   misspelled/unregistered tools. Stories are deterministic (mock providers +
   canned runner, only `example.invalid` URLs, no Math.random, no external
   accounts).
4. Assertions are discriminating: Story A asserts PermissionDenied for an
   unapproved download; Story B asserts `out.srt` exists on disk with non-empty
   content; Story D validates every variant against its own profile; Story E
   asserts PermissionDenied before approval and `published` after (via
   post_status).
5. Harness spread-order fix is correct (OK defaults cannot clobber canned
   ffprobe stdout).
6. RED `0aee2b8` genuinely failed (temp worktree: 6 files failed on missing
   `./harness.js` / `@dsh-forge-creator/presets`); GREEN `177d07d` passes;
   REFACTOR `5712565` docs.
7. Lockfile + root package.json record `@dsh-forge-creator/presets`.

## Blocking findings

None.

## Non-blocking notes (disposition)

1. **Story E reached into publish internals** (`contentHashOf` from
   `src/registry.js`) — publish now re-exports `contentHashOf` from its public
   index; story-e imports it from the package entry. FIXED (commit `31fb1f7`).
2. **Harness `cleanup()` never invoked** — every story now runs
   `afterAll(() => e2e.cleanup())`. FIXED (commit `31fb1f7`).
3. **Story D validates in-memory records, not PNG pixels** — consistent with
   the plugin's mock design; failure paths covered by unit tests. Accepted.
4. **Story C localize_video assertion light** — now asserts
   `outputPath === "loc/localized.srt"` and the file exists on disk. FIXED
   (commit `31fb1f7`).
5. **Design note (pre-existing)**: post_publish gates on the approval arg, not
   ctx; host never exposes createApproval to an agent (documented in
   core safety). Accepted, no change.
