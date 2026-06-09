# claude-mem 13.4.2 Codex Local Patch Overlay

This directory contains the minimal reviewed patch overlay for the Codex
`claude-mem` 13.4.2 runtime.

Apply it only to `claude-mem` version `13.4.2`. This overlay intentionally
contains only:

```text
.install-version
hooks/codex-hooks.json
hooks/hooks.json
scripts/codex-hook-output-filter.js
skills/standup/SKILL.md
```

The patch fixes 13.4.2 workstation issues observed with Codex:

- `skills/standup/SKILL.md` had a frontmatter description longer than Codex's
  1024-character skill description limit.
- `SessionStart` hooks emitted unsupported `suppressOutput`, multiple JSON
  documents, or empty stdout on no-input warm-up sessions.
- Codex `PreToolUse` and `PostToolUse` rejected worker output containing
  top-level `suppressOutput`; Codex hook commands now pipe through
  `scripts/codex-hook-output-filter.js`.
- Codex and Claude-side plugin trees can diverge; apply this overlay to every
  live-resolvable plugin root, not only the Codex cache.

Install target:

```bash
PLUGIN=$(ls -dt ~/.codex/plugins/cache/claude-mem-local/claude-mem/[0-9]* 2>/dev/null | head -1)
test -n "$PLUGIN" && test -d "$PLUGIN"
test "$(jq -r .version "$PLUGIN/.codex-plugin/plugin.json")" = "13.4.2"
rsync -a overlays/claude-mem/13.4.2/ "$PLUGIN"/
```

If the marketplace snapshot is present and the workstation may reinstall from
it, apply the same minimal overlay there too:

```bash
MARKET="$HOME/.codex/.tmp/marketplaces/claude-mem-local/plugin"
test -d "$MARKET" && rsync -a overlays/claude-mem/13.4.2/ "$MARKET"/
```

Also patch the Claude-side roots when present because the Codex hook resolver
can fall back to them:

```bash
CLAUDE_CACHE="$HOME/.claude/plugins/cache/thedotmack/claude-mem/13.4.2"
CLAUDE_MARKET="$HOME/.claude/plugins/marketplaces/thedotmack/plugin"
test -d "$CLAUDE_CACHE" && rsync -a overlays/claude-mem/13.4.2/ "$CLAUDE_CACHE"/
test -d "$CLAUDE_MARKET" && rsync -a overlays/claude-mem/13.4.2/ "$CLAUDE_MARKET"/
```

Verify:

```bash
jq -e '.hooks.SessionStart and .hooks.UserPromptSubmit and .hooks.PreToolUse and .hooks.PostToolUse and .hooks.Stop' \
  "$PLUGIN/hooks/codex-hooks.json" >/dev/null
jq -e '.hooks.SessionStart and .hooks.UserPromptSubmit and .hooks.PostToolUse and .hooks.Stop' \
  "$PLUGIN/hooks/hooks.json" >/dev/null
! grep -ERn 'suppressOutput:!0|suppressOutput:true|"suppressOutput":true' \
  "$PLUGIN/hooks/codex-hooks.json" "$PLUGIN/hooks/hooks.json"

printf '%s\n' '{"continue":true,"suppressOutput":true}' |
  node "$PLUGIN/scripts/codex-hook-output-filter.js" --event PostToolUse
```

Expected filter output:

```json
{"continue":true}
```

Then start a fresh Codex session and run the warm-up prompt from the runbook.
Expected: exact `Ready.`, no invalid skill warning, no `SessionStart Failed`,
and no `unsupported suppressOutput`.

Do not put API keys or machine-local secrets in this directory.
