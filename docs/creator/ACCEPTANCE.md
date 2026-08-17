# Creator Pack — Final Acceptance (taskbook §30)

The taskbook's §30 final acceptance lists 8 scenarios that must run from a
fresh clone before release. All 8 are covered by deterministic E2E stories in
`tests/creator-e2e/` (mock providers; no external accounts, no network). The
coverage is locked by `tests/creator-e2e/acceptance-coverage.test.ts`.

| # | Scenario (taskbook §30) | E2E story |
| --- | --- | --- |
| 1 | AI 科普选题 — top 3 topics + evidence + opportunity score | `story-a-research` (trend_fetch + opportunity_rank + topic_score) |
| 2 | 授权素材到字幕 — inspect → rights → capture → transcribe → SRT | `story-a-research` + `story-b-short-video` |
| 3 | 长视频转竖屏 — fixture → transcript → clip → 9:16 → validate | `story-b-short-video` |
| 4 | 封面多平台适配 — base → youtube/bilibili/xiaohongshu → validate | `story-d-cover` |
| 5 | 本地化 — SRT → translate → align → mock TTS → localized asset | `story-c-localize` |
| 6 | 安全发布 — draft → preview → blocked → approve → publish → status | `story-e-publish` |
| 7 | 审批失效 — approve draft A; publish different B with A's approval → BLOCKED | `story-f-approval-invalidation` |
| 8 | 重试幂等 — status unknown → query → already published → no duplicate | `story-g-retry-idempotency` |

## Run from a fresh clone

```sh
git clone <repo> && cd dsh-forge-creator-pack
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test && pnpm build
node scripts/creator-release-gate.ts   # "[release-gate] ok: ready to tag"
pnpm exec vitest run tests/creator-e2e # 8 files / 11 tests (all 8 scenarios)
```

## Acceptance run log (2026-08-17)

- **Windows (local fresh clone)**: clean `git clone` of the release branch →
  `pnpm install --frozen-lockfile` → typecheck/lint/test (438 → now 440 tests
  with stories F/G) → build → release gate, all pass. E2E suite 8 files / 11
  tests green.
- **ubuntu-latest (CI)**: `verify` + `creator-contract` jobs run on every PR
  (fresh checkout), including the E2E stories and the release gate.

Scenario-by-scenario status (from the deterministic E2E suite):
S1 ✓ S2 ✓ S3 ✓ S4 ✓ S5 ✓ S6 ✓ S7 ✓ S8 ✓

## Notes

- Scenarios 7 & 8 were already unit-tested in `publish.test.ts` (content-hash
  approval binding; unknown-status query-before-resend); the E2E stories lock
  the same semantics at the acceptance level.
- All runs are deterministic — no real social accounts, no network, no
  binaries (canned media runner in `harness.ts`).
