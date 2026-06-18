# claude-mem 13.6.2 Codex Local Patch Overlay

This directory contains the minimal reviewed patch overlay for the Codex
`claude-mem` 13.6.2 runtime.

Apply it only to `claude-mem` version `13.6.2`. This overlay intentionally
contains only:

```text
.install-version
hooks/codex-hooks.json
scripts/codex-hook-output-filter.js
```

The patch fixes 13.6.2 workstation issues observed with Codex 0.140:

- Upstream `plugin/hooks/codex-hooks.json` still contains a top-level
  `description` field. Codex 0.140 rejects plugin hook manifests with unknown
  top-level fields, so this overlay keeps `hooks` as the only top-level key.
- Upstream install snapshots can miss `.install-version` and
  `scripts/codex-hook-output-filter.js`, which breaks version checks and
  user-level hooks that pipe worker output through the filter.
- A Git tag marketplace refresh can overwrite local cache patches. The verified
  workstation fix pins `claude-mem-local` to a local marketplace snapshot and
  applies this overlay to all live-resolvable roots.
- Hook resolvers must prefer the active 13.6.2 Codex/local roots before older
  Claude cache roots; otherwise the worker can restart from an older cache even
  after `codex plugin list` reports 13.6.2.

Install targets:

```bash
PLUGIN=$(codex plugin list | awk '/claude-mem@claude-mem-local/ {print $NF; exit}')
test -n "$PLUGIN" && test -d "$PLUGIN"
test "$(jq -r .version "$PLUGIN/.codex-plugin/plugin.json")" = "13.6.2"
rsync -a overlays/claude-mem/13.6.2/ "$PLUGIN"/
```

Also patch the versioned and fallback roots when present because Codex hooks can
resolve through any of them:

```bash
for TARGET in \
  "$HOME/.codex/local-marketplaces/claude-mem-local/plugin" \
  "$HOME/.codex/plugins/cache/claude-mem-local/claude-mem/13.6.2" \
  "$HOME/.codex/.tmp/marketplaces/claude-mem-local/plugin" \
  "$HOME/.claude/plugins/cache/thedotmack/claude-mem/13.6.2" \
  "$HOME/.claude/plugins/marketplaces/thedotmack/plugin"
do
  test -d "$TARGET" && rsync -a overlays/claude-mem/13.6.2/ "$TARGET"/
done
```

Verify:

```bash
jq -e 'keys == ["hooks"]' "$PLUGIN/hooks/codex-hooks.json"
jq -e '.hooks.SessionStart and .hooks.UserPromptSubmit and .hooks.PreToolUse and .hooks.PostToolUse and .hooks.Stop' \
  "$PLUGIN/hooks/codex-hooks.json" >/dev/null
! grep -ERn 'suppressOutput:!0|suppressOutput:true|"suppressOutput":true' \
  "$PLUGIN/hooks/codex-hooks.json"

printf '%s\n' '{"continue":true,"suppressOutput":true}' |
  node "$PLUGIN/scripts/codex-hook-output-filter.js" --event PostToolUse
```

Expected filter output:

```json
{"continue":true}
```

Final acceptance is a fresh Codex lifecycle smoke that exercises startup,
prompt, tool, and stop hook paths with no parse warning, MCP startup
interruption, or `Failed` hook line. A warm-up-only prompt is not sufficient.

Do not put API keys or machine-local secrets in this directory.
