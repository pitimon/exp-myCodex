# claude-mem 13.4.1 Codex Local Patch Overlay

This directory contains the minimal reviewed patch overlay for the Codex
`claude-mem` 13.4.1 runtime.

Apply it only to `claude-mem` version `13.4.1`. This overlay intentionally
contains only:

```text
hooks/codex-hooks.json
hooks/hooks.json
skills/standup/SKILL.md
```

The patch fixes two 13.4.1 workstation issues observed with Codex `0.137.0`:

- `skills/standup/SKILL.md` had a frontmatter description longer than Codex's
  1024-character skill description limit.
- `SessionStart` hooks emitted unsupported `suppressOutput`, multiple JSON
  documents, or empty stdout on no-input warm-up sessions.

Install target:

```bash
PLUGIN=$(ls -dt ~/.codex/plugins/cache/claude-mem-local/claude-mem/[0-9]* 2>/dev/null | head -1)
test -n "$PLUGIN" && test -d "$PLUGIN"
test "$(jq -r .version "$PLUGIN/.codex-plugin/plugin.json")" = "13.4.1"
rsync -a overlays/claude-mem/13.4.1/ "$PLUGIN"/
```

If the marketplace snapshot is present and the workstation may reinstall from
it, apply the same minimal overlay there too:

```bash
MARKET="$HOME/.codex/.tmp/marketplaces/claude-mem-local/plugin"
test -d "$MARKET" && rsync -a overlays/claude-mem/13.4.1/ "$MARKET"/
```

Verify:

```bash
jq -e '.hooks.SessionStart and .hooks.UserPromptSubmit and .hooks.PostToolUse and .hooks.Stop' \
  "$PLUGIN/hooks/codex-hooks.json" >/dev/null
jq -e '.hooks.SessionStart and .hooks.UserPromptSubmit and .hooks.PostToolUse and .hooks.Stop' \
  "$PLUGIN/hooks/hooks.json" >/dev/null
! grep -ERn 'suppressOutput:!0|suppressOutput:true|"suppressOutput":true' \
  "$PLUGIN/hooks/codex-hooks.json" "$PLUGIN/hooks/hooks.json"
```

Then start a fresh Codex session and run the warm-up prompt from the runbook.
Expected: exact `Ready.`, no invalid skill warning, and no `SessionStart Failed`.

Do not put API keys or machine-local secrets in this directory.
