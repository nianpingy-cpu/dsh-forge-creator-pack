# Creator Pack — Quickstart (CREATOR-016)

## 1. Install & verify

```sh
git clone git@github.com:nianpingy-cpu/dsh-forge-creator-pack.git
cd dsh-forge-creator-pack
pnpm install
pnpm typecheck
pnpm lint
pnpm test      # 438 unit + contract + integration + e2e tests
pnpm build
node scripts/creator-release-gate.ts   # pre-tag gate (must print "ok: ready to tag")
```

## 2. Pick a preset

```ts
import { PRESETS } from "@dsh-forge-creator/presets";

// Load the tools of one preset into your harness and register them.
const preset = PRESETS.find((p) => p.name === "creator-video");
for (const plugin of preset!.plugins) {
  for (const tool of plugin.tools) registerTool(tool);
}
```

Four presets: `creator-research`, `creator-video`, `creator-publisher`,
`creator-full`. Each declares its plugin list and the skill slugs
(`skills/creator/*.md`) that describe how to use them well.

## 3. A minimal research flow (deterministic, mock)

```ts
// trend -> rank -> inspect -> authorized capture
const trends = await invoke("trend_fetch", { source: "mock" });
const ranked = await invoke("opportunity_rank", {});
await invoke("media_inspect", { sourceUrl });
const asset = await invoke("media_download", {
  sourceUrl, outputPath: "capture.mp4",
  rights: { status: "owned" }, conflict: "fail",
}); // requires ctx.permission.approved === true
```

## 4. Publishing is always approval-gated

```ts
const { draftId } = await invoke("post_create_draft", { draft, provider: "mock" });
await invoke("post_preview", { draft });
// WITHOUT an approval object this is PermissionDenied:
await invoke("post_publish", { draftId, provider: "mock" }); // -> PermissionDenied
// AFTER explicit approval (host-supplied, scope creator-remote-publish):
await invoke("post_publish", { draftId, approval, provider: "mock" }); // -> published
```

The `approval` object is minted by the host with `createApproval` (content-hash
bound, scoped, expiring) — the model/agent never mints it itself.

## 5. Where to go next

- [SAFETY.md](SAFETY.md) — the permission & approval model.
- [PROVIDERS.md](PROVIDERS.md) — mock / external provider matrix.
- [EXAMPLES.md](EXAMPLES.md) — complete story scripts.
- [RELEASE_NOTES.md](RELEASE_NOTES.md) — what is in this release.
