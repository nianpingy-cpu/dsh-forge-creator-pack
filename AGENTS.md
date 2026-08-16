# AGENTS.md

Rules for AI coding agents working in this repository. These rules are binding.

This is the **DSH Forge Creator Pack** — a dedicated repository for the
creator-workflow plugin set on top of the DeepSeek Harness (`dsh`) plugin
ecosystem. It is NOT a fork that re-implements the existing `dsh-forge`
Developer Pack; it carries an adapted copy of `@dsh-forge/core` (MIT) extended
with Creator-domain contracts, and all plugins reuse that single core (no
second infrastructure).

## Process

1. Work one GitHub issue at a time, in dependency order. Never implement
   multiple unrelated issues in one PR.
2. Follow strict TDD: RED (failing test, committed) → GREEN (minimal
   implementation, committed) → REFACTOR (separate commit, tests stay green).
3. A RED failure must be a missing-feature failure, not an import/syntax/setup
   error (except where an issue explicitly defines otherwise, e.g. bootstrap).
4. Never delete, skip, or weaken a test to make CI green. Never mark real
   failures as expected.
5. Review findings are fixed via regression TDD: failing regression test
   first, then the fix.
6. Update `PROJECT_STATUS.md` after every merge.
7. Every PR requires at least one external (non-implementer) model review
   before merge. Never fabricate a review. Review artifacts live under
   `reviews/PR-N/` and must never contain secrets.

## Security (non-negotiable)

1. No arbitrary shell execution. `shell: true` is forbidden. Tools take typed
   arguments compiled to `argv[]` (ADR-004).
2. All write operations must verify the target path stays inside the workspace
   (ADR-005). Media assets and output paths always go through the core
   workspace policy.
3. Never inherit the full environment into third-party CLIs. Use env
   allowlists (core provides `DEFAULT_ENV_ALLOWLIST`).
4. Never commit secrets, API keys, tokens, cookies, sessions, refresh tokens,
   or `.env` files. `CredentialRef` is a reference only — never a value.
5. Side-effecting tools declare `MutationClass` and go through the DeepSeek
   Harness permission system.
6. No remote publishing without explicit approval. Default is
   draft / preview / dry-run. CI must never publish real social content.
7. No CAPTCHA bypass, anti-detection, or DRM bypass.
8. Voice cloning requires explicit authorization. Rights/provenance metadata
   is preserved on every captured or generated asset.
9. GPL/AGPL/unknown-license upstreams are integrated as adapter/provider only —
   never vendored. See `docs/creator/ECOSYSTEM_MATRIX.md` (CREATOR-001).

## Git

1. Conventional Commits only (`test(scope):`, `feat(scope):`, `fix(scope):`,
   `refactor(scope):`, `docs(scope):`, `chore(scope):`, `ci(scope):`).
2. Branching: `main` → `release/vX.Y.Z` → `VX.Y.Z/issue-NNN-slug`. PRs target
   the version branch, never `main` directly.
3. Reference the issue number in every commit message: `(#N)`.

## Upstream compatibility

DeepSeek Harness is in developer preview. The core process runner, permission
and workspace policies come from the adapted `@dsh-forge-creator/core`
(superset of `@dsh-forge/core`). Do not create a second runner/policy stack.

## Issue numbering

The Creator Pack taskbook uses logical IDs `CREATOR-001` … `CREATOR-016`. The
GitHub-assigned issue number `#NN` is used in branch names and commits; the
logical ID is kept in the issue title, e.g. `[CREATOR-001] Ecosystem & Overlap Lock`.
