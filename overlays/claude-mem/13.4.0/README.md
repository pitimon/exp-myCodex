# claude-mem 13.4.0 Codex Local Patch Overlay

This directory is the reviewed local patch overlay for the Codex `claude-mem`
runtime described in:

```text
docs/runbooks/plugins/claude-mem.md
```

Apply it only to `claude-mem` version `13.4.0`. After applying it, run
`scripts/codex-hook-mode.cjs balanced` from the active installed cache so the
`PostToolUse` hook is rewritten for the current machine's plugin root.

Patched files:

```text
.mcp.json
modes/code.json
scripts/worker-service.cjs
scripts/transcript-watcher.cjs
scripts/codex-hook-spool.cjs
scripts/codex-hook-drain.cjs
scripts/codex-hook-mode.cjs
package.json
hooks/codex-hooks.json
hooks/hooks.json
```

Install target:

```bash
PLUGIN=$(ls -dt ~/.codex/plugins/cache/claude-mem-local/claude-mem/[0-9]* 2>/dev/null | head -1)
test -n "$PLUGIN" && test -d "$PLUGIN"
test "$(jq -r .version "$PLUGIN/.codex-plugin/plugin.json")" = "13.4.0"
rsync -a overlays/claude-mem/13.4.0/ "$PLUGIN"/
node --check "$PLUGIN/scripts/worker-service.cjs"
node --check "$PLUGIN/scripts/transcript-watcher.cjs"
node --check "$PLUGIN/scripts/codex-hook-spool.cjs"
node --check "$PLUGIN/scripts/codex-hook-drain.cjs"
node --check "$PLUGIN/scripts/codex-hook-mode.cjs"
node "$PLUGIN/scripts/codex-hook-mode.cjs" balanced
jq -e '.hooks.SessionStart and .hooks.UserPromptSubmit and .hooks.PostToolUse' "$PLUGIN/hooks/codex-hooks.json" >/dev/null
jq -e '.hooks.SessionStart and .hooks.UserPromptSubmit and .hooks.PostToolUse' "$PLUGIN/hooks/hooks.json" >/dev/null
node "$PLUGIN/scripts/codex-hook-mode.cjs" status
```

This overlay carries the balanced Codex hook topology used on 2026-06-08. It
intentionally does not include the older Codex wrapper files
(`codex-worker-hook.cjs`, `codex-context-silent.cjs`, compact bridge wrappers)
or the old regression test, because the active installed cache no longer uses
that topology.

The `SessionStart` context hooks in both `hooks/codex-hooks.json` and
`hooks/hooks.json` are wrapped to fail open with `{"continue":true}` when the
context command produces no stdout. This prevents an empty Codex warm-up turn
from being reported as a hard startup failure while still preserving real
context output when available.

The worker start hooks also emit only a single `{"continue":true}` hook result.
They intentionally discard the worker start command's own status JSON because
some Codex hook paths report a `SessionStart Failed` warning when a startup
hook emits additional fields or multiple JSON documents.

Do not put API keys or machine-local secrets in this directory.
