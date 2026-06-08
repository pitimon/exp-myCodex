# Codex and claude-mem Memory Runbook

Date: 2026-06-08
Status: Public Codex plugin runbook, adapted from a verified local runtime

## Purpose

This runbook covers only the `claude-mem` layer used by Codex.

Use it for:

- startup context and warm-up behavior
- `mcp-search` historical memory lookup
- `claude-mem` worker health
- provider/model settings
- Codex plugin hook behavior
- local plugin cache drift
- incident mode when hooks slow or block Codex

This public export intentionally excludes the private Obsidian workflow. Treat
Obsidian as a separate optional integration and do not require it for
`claude-mem` health.

## Safety

Do not print, paste, or store API keys, OAuth tokens, bearer tokens, private
keys, kubeconfigs, passwords, or customer-sensitive raw data.

When inspecting `~/.claude-mem/settings.json`, print only boolean secret
presence and length. Do not run broad secret scans against local config files
while memory hooks are enabled.

Some verification snippets use `rg` for concise filtering. If `rg` is missing
on the target workstation, use `grep` for the same narrow pattern or report
`ripgrep=missing` rather than skipping the rest of the runtime validation.

## Architecture

```text
Codex session
  |
  |-- claude-mem Codex plugin hooks
  |     |-- SessionStart: version check / startup context path
  |     |-- UserPromptSubmit: session-init/context injection
  |     |-- PostToolUse: async spool for observations
  |     `-- Stop: session summary
  |
  |-- MCP server: mcp-search
  |     `-- read/search claude-mem observations
  |
  `-- claude-mem worker
        `-- SQLite store, queue processing, provider calls, search API
```

Current local behavior is hook-based. Older compact-bridge wrapper files are
historical unless an old session or old cache is being debugged.

## Current Verified State

Verified on 2026-06-08:

```text
worker health endpoint: http://127.0.0.1:37701/api/health
worker status: ok
worker version: 13.4.0
worker path: a current-user claude-mem worker-service.cjs path
worker provider: claude
worker auth: Claude Code OAuth token read from system keychain at spawn
settings provider: CLAUDE_MEM_PROVIDER=claude
settings model alias: CLAUDE_MEM_MODEL=haiku
OpenRouter rollback model retained: google/gemini-2.5-flash-lite
CLAUDE_MEM_CODEX_TRANSCRIPT_INGESTION=false
```

Other workstations may use port `37777` instead of `37701`. Multi-user hosts can
also have both ports healthy at once, where one port belongs to another user.
Always verify the actual worker port from `~/.claude-mem/worker.pid`, settings,
health probes, and the live worker process before declaring the runtime healthy
or unhealthy.

Rollback snapshots currently exist under `~/.claude-mem/backups/`, including:

```text
settings.openrouter-rollback-20260607-051714.json
settings.failed-claude-provider-20260607-052940.json
settings.claude-provider-working-20260607-080233.json
```

The live `provider=claude` state was previously verified to write real
observations after the empty/warm-up poisoning issue was isolated. The residual
risk is still the empty case: repeated no-work turns can produce prose instead
of XML and poison the SDK session. Do not interpret that as proof that
substantive work cannot be stored.

## Important Paths

```text
~/.claude-mem/settings.json
~/.claude-mem/worker.pid
~/.claude-mem/claude-mem.db
~/.claude-mem/logs/claude-mem-YYYY-MM-DD.log
~/.claude-mem/backups/
~/.codex/config.toml
~/.codex/plugins/cache/claude-mem-local/claude-mem/13.4.0/
overlays/claude-mem/13.4.0/
```

## Startup Behavior

Codex has no documented pre-input hook that runs before the first user prompt
exists. Treat `SessionStart` context as best-effort startup context for the
first model turn, not as a separate pre-session phase.

If Codex prints:

```text
claude-mem: runtime not yet set up - run: npx claude-mem@latest install
```

do not treat that line as final truth. Verify the worker, MCP path, logs, and
real memory lookup before deciding the runtime is broken.

## Warm-Up-Only Session Prompt

Use this when the only goal is to let configured startup context and hooks
initialize before real work.

Prompt text:

```text
Session warm-up only. Load configured startup context and initialize hooks. Do not run tools, inspect files, or modify anything. Reply exactly: Ready.
```

Expected assistant response:

```text
Ready.
```

Assistant rule: do not run tools, inspect files, edit files, search memory, or
add commentary in response to this prompt. The exact reply is the whole task.

### Bash, zsh, or sh

Use a quoted prompt so shell history and wrappers preserve the exact text:

```bash
codex 'Session warm-up only. Load configured startup context and initialize hooks. Do not run tools, inspect files, or modify anything. Reply exactly: Ready.'
```

On machines where Node and Codex are installed through NVM, a non-login SSH
shell may not have `codex`, `node`, or `npx` on `PATH`. Initialize NVM or use
the absolute Codex path before running validation:

```bash
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
fi

command -v codex
command -v node
command -v npx
```

If using the local interactive wrapper:

```bash
codex
# paste the warm-up prompt as the first user message
```

Bypass the wrapper when needed:

```bash
command codex
```

### PowerShell

PowerShell single quotes preserve the prompt literally:

```powershell
codex 'Session warm-up only. Load configured startup context and initialize hooks. Do not run tools, inspect files, or modify anything. Reply exactly: Ready.'
```

For interactive use:

```powershell
codex
# paste the warm-up prompt as the first user message
```

## Optional macOS Startup Wrapper

This workstation may use:

```text
~/.local/bin/codex-preloaded
```

with a shell alias:

```bash
alias codex='codex-preloaded'
```

This is local UX only. It is not required for `claude-mem`, `mcp-search`, or
Codex memory injection.

Verify on macOS/zsh:

```bash
zsh -ic 'type codex; type codex-preloaded'
```

## Codex Config

Relevant `~/.codex/config.toml` shape:

```toml
[plugins."claude-mem@claude-mem-local"]
enabled = true

[plugins."claude-mem@claude-mem-local".mcp_servers.mcp-search.tools.search]
approval_mode = "approve"

[plugins."claude-mem@claude-mem-local".mcp_servers.mcp-search.tools.get_observations]
approval_mode = "approve"

[features]
memories = true
```

`obsidian-vault` in `codex mcp list` is not required for `claude-mem` health.

## Recommended Claude Code First Preflight

Recommended order for a new workstation:

1. Install and validate `claude-mem` with Claude Code first.
2. Confirm the shared `claude-mem` worker is healthy.
3. Then install or update the Codex `claude-mem` plugin.

The practical reason is that `claude-mem` may already be installed and working
through Claude Code. In that case, the Codex task is mostly to connect Codex to
the existing runtime through plugin hooks and `mcp-search`, not to overwrite a
healthy worker.

Use this preflight before any Codex-side install or overlay:

```bash
test -d ~/.claude-mem && printf 'claude_mem_home=present\n' || printf 'claude_mem_home=missing\n'
test -f ~/.claude-mem/settings.json && printf 'settings=present\n' || printf 'settings=missing\n'
test -f ~/.claude-mem/worker.pid && jq '{pid,port,startedAt}' ~/.claude-mem/worker.pid || true

for port in 37701 37777; do
  printf 'checking_port=%s\n' "$port"
  curl -fsS "http://127.0.0.1:${port}/api/health" | jq . || true
done

ps -axo pid,command | grep -E 'claude-mem|worker-service' | grep -v grep || true
```

For each healthy candidate port, confirm the health `workerPath` belongs to the
current user's expected `claude-mem` runtime. A `200 OK` health response from
another user's worker, an older version, or a different home directory is not
evidence that this account's Codex runtime is healthy.

Check secret presence only, not secret values:

```bash
if [ -f ~/.claude-mem/settings.json ]; then
  jq '{
    CLAUDE_MEM_PROVIDER,
    CLAUDE_MEM_MODEL,
    CLAUDE_MEM_OPENROUTER_MODEL,
    CLAUDE_MEM_WORKER_HOST,
    CLAUDE_MEM_WORKER_PORT,
    CLAUDE_MEM_CODEX_TRANSCRIPT_INGESTION,
    CLAUDE_MEM_CHROMA_ENABLED,
    has_openrouter_key: (.CLAUDE_MEM_OPENROUTER_API_KEY | type == "string" and length > 0),
    openrouter_key_length: (.CLAUDE_MEM_OPENROUTER_API_KEY | if type == "string" then length else 0 end)
  }' ~/.claude-mem/settings.json
fi
```

If `CLAUDE_MEM_CHROMA_ENABLED=true`, verify `uvx` is available in the worker
environment before calling Chroma-backed search healthy:

```bash
command -v uvx || command -v uv || true
tail -n 160 ~/.claude-mem/logs/claude-mem-$(date +%Y-%m-%d).log 2>/dev/null |
  rg 'CHROMA|uvx|chroma-mcp|Executable not found|Connected to chroma-mcp'
```

If `uvx` is missing on Linux or WSL, install `uv` from the official Astral
installer and restart the worker with `~/.local/bin` on `PATH`:

```bash
curl -fsSL https://astral.sh/uv/install.sh -o /tmp/uv-install.sh
less /tmp/uv-install.sh
UV_NO_MODIFY_PATH=1 sh /tmp/uv-install.sh
export PATH="$HOME/.local/bin:$PATH"
npx claude-mem@latest restart
uv --version
uvx --version
```

If the worker is already healthy, continue with the Codex plugin install and
post-install verification. If the worker is missing or unhealthy, fix the
Claude Code `claude-mem` install first, then return to this runbook.

## Install claude-mem Plugin

Use this on a workstation that does not yet have the Codex `claude-mem`
plugin installed.

1. Add or refresh the marketplace.

```bash
codex plugin marketplace add thedotmack/claude-mem
codex plugin marketplace list
```

If the marketplace is already present, refresh it instead:

```bash
codex plugin marketplace upgrade claude-mem-local
```

2. Install the plugin from the marketplace snapshot.

```bash
codex plugin add claude-mem@claude-mem-local
codex plugin list
codex mcp list
```

Expected local highlights:

```text
claude-mem@claude-mem-local installed, enabled
mcp-search                   enabled
```

3. Find the active installed cache path.

```bash
PLUGIN=$(ls -dt ~/.codex/plugins/cache/claude-mem-local/claude-mem/[0-9]* 2>/dev/null | head -1)
printf '%s\n' "$PLUGIN"
test -n "$PLUGIN" && test -d "$PLUGIN"
jq -r '.version' "$PLUGIN/.codex-plugin/plugin.json"
```

Expected local version for this runbook:

```text
13.4.0
```

4. Verify the worker and MCP path with the `Runtime Verification` section.

Do not apply any local overlay until the active cache path and version are
known.

## Update claude-mem Plugin

Use this after a Codex update, a `claude-mem` marketplace update, or when a
target workstation may have a stale marketplace snapshot.

1. Capture the current state without secrets.

```bash
date
codex plugin marketplace list
codex plugin list
codex mcp list

PLUGIN=$(ls -dt ~/.codex/plugins/cache/claude-mem-local/claude-mem/[0-9]* 2>/dev/null | head -1)
printf 'active_plugin=%s\n' "$PLUGIN"
test -n "$PLUGIN" && jq -r '.version' "$PLUGIN/.codex-plugin/plugin.json"

jq '{
  CLAUDE_MEM_PROVIDER,
  CLAUDE_MEM_MODEL,
  CLAUDE_MEM_OPENROUTER_MODEL,
  CLAUDE_MEM_WORKER_HOST,
  CLAUDE_MEM_WORKER_PORT,
  has_openrouter_key: (.CLAUDE_MEM_OPENROUTER_API_KEY | type == "string" and length > 0),
  openrouter_key_length: (.CLAUDE_MEM_OPENROUTER_API_KEY | if type == "string" then length else 0 end)
}' ~/.claude-mem/settings.json
```

2. Back up local settings and the active hook file.

```bash
cp ~/.claude-mem/settings.json ~/.claude-mem/settings.json.bak-plugin-update-$(date +%Y%m%d%H%M%S)
chmod 600 ~/.claude-mem/settings.json.bak-plugin-update-*

if [ -n "$PLUGIN" ] && [ -f "$PLUGIN/hooks/codex-hooks.json" ]; then
  cp "$PLUGIN/hooks/codex-hooks.json" \
    "$PLUGIN/hooks/codex-hooks.json.bak-plugin-update-$(date +%Y%m%d%H%M%S)"
fi
```

3. Refresh the marketplace snapshot and reinstall from it.

```bash
codex plugin marketplace upgrade claude-mem-local
codex plugin add claude-mem@claude-mem-local
```

4. If the version or active cache remains stale, remove and add the plugin.

Use this only after the backup above:

```bash
codex plugin remove claude-mem@claude-mem-local
codex plugin add claude-mem@claude-mem-local
```

5. Re-discover the active installed cache.

```bash
PLUGIN=$(ls -dt ~/.codex/plugins/cache/claude-mem-local/claude-mem/[0-9]* 2>/dev/null | head -1)
printf '%s\n' "$PLUGIN"
test -n "$PLUGIN" && test -d "$PLUGIN"
jq -r '.version' "$PLUGIN/.codex-plugin/plugin.json"
```

6. Reconcile the local overlay before calling the update complete.

Do not blindly `rsync` an old overlay into the active cache. Check whether the
target cache already has the balanced Codex hook helper files:

```bash
test -f "$PLUGIN/scripts/codex-hook-spool.cjs"
test -f "$PLUGIN/scripts/codex-hook-drain.cjs"
test -f "$PLUGIN/scripts/codex-hook-mode.cjs"
```

If those files are missing and this repo has the overlay assets, apply the
reviewed overlay only after the version guard passes:

```bash
PATCH_ROOT=overlays/claude-mem/13.4.0
test -d "$PATCH_ROOT"
test "$(jq -r '.version' "$PLUGIN/.codex-plugin/plugin.json")" = "13.4.0"

for f in \
  hooks/codex-hooks.json \
  hooks/hooks.json \
  scripts/worker-service.cjs \
  scripts/transcript-watcher.cjs \
  scripts/codex-hook-spool.cjs \
  scripts/codex-hook-drain.cjs \
  scripts/codex-hook-mode.cjs \
  modes/code.json \
  .mcp.json \
  package.json
do
  if [ -e "$PLUGIN/$f" ]; then
    mkdir -p "$PLUGIN/$(dirname "$f")"
    cp "$PLUGIN/$f" "$PLUGIN/$f.bak-overlay-$(date +%Y%m%d%H%M%S)"
  fi
done

rsync -a "$PATCH_ROOT"/ "$PLUGIN"/
```

After applying the overlay, make the `PostToolUse` hook target the current
machine's active plugin root:

```bash
node "$PLUGIN/scripts/codex-hook-mode.cjs" balanced
```

7. Restart the worker and Codex.

```bash
npx claude-mem@latest restart
```

Then fully restart Codex. Hook files are loaded when a Codex session starts.

8. Run `Post-Install And Post-Update Verification`.

## Post-Install And Post-Update Verification

Run this after a fresh install, marketplace upgrade, remove/add cycle, overlay
apply, provider change, or Codex CLI upgrade.

1. Verify active plugin and MCP state.

```bash
codex plugin list
codex mcp list
PLUGIN=$(ls -dt ~/.codex/plugins/cache/claude-mem-local/claude-mem/[0-9]* 2>/dev/null | head -1)
printf 'active_plugin=%s\n' "$PLUGIN"
jq -r '.version' "$PLUGIN/.codex-plugin/plugin.json"
```

2. Verify syntax and hook shape.

```bash
node --check "$PLUGIN/scripts/worker-service.cjs"
node --check "$PLUGIN/scripts/transcript-watcher.cjs"
node --check "$PLUGIN/scripts/codex-hook-spool.cjs"
node --check "$PLUGIN/scripts/codex-hook-drain.cjs"
node --check "$PLUGIN/scripts/codex-hook-mode.cjs"

jq -e '.hooks.SessionStart and .hooks.UserPromptSubmit and .hooks.PostToolUse and .hooks.Stop' \
  "$PLUGIN/hooks/codex-hooks.json" >/dev/null

node "$PLUGIN/scripts/codex-hook-mode.cjs" status
```

3. Verify Codex does not reject legacy hook output fields.

```bash
! rg -n 'suppressOutput:!0|suppressOutput:true|"suppressOutput":true' \
  "$PLUGIN/scripts/worker-service.cjs" \
  "$PLUGIN/hooks/codex-hooks.json" \
  "$PLUGIN/hooks/hooks.json"

if [ -f ~/.codex/scripts/codex-stop-obsidian-capture.cjs ]; then
  ! rg -n 'suppressOutput:!0|suppressOutput:true|"suppressOutput":true' \
    ~/.codex/scripts/codex-stop-obsidian-capture.cjs
fi
```

4. Verify worker health.

```bash
jq '{pid,port,startedAt}' ~/.claude-mem/worker.pid

for port in 37701 37777; do
  printf 'checking_port=%s\n' "$port"
  curl -fsS "http://127.0.0.1:${port}/api/health" | jq . || true
done

ps -axo pid,command | grep -E 'claude-mem|worker-service' | grep -v grep || true
```

5. Verify settings without secrets.

```bash
jq '{
  CLAUDE_MEM_PROVIDER,
  CLAUDE_MEM_MODEL,
  CLAUDE_MEM_OPENROUTER_MODEL,
  CLAUDE_MEM_WORKER_HOST,
  CLAUDE_MEM_WORKER_PORT,
  CLAUDE_MEM_CODEX_TRANSCRIPT_INGESTION,
  has_openrouter_key: (.CLAUDE_MEM_OPENROUTER_API_KEY | type == "string" and length > 0),
  openrouter_key_length: (.CLAUDE_MEM_OPENROUTER_API_KEY | if type == "string" then length else 0 end)
}' ~/.claude-mem/settings.json
```

6. Verify search and queue behavior.

```bash
sqlite3 ~/.claude-mem/claude-mem.db \
  "select status, count(*) from pending_messages group by status;"

sqlite3 -header -column ~/.claude-mem/claude-mem.db \
  "select id,type,title,created_at from observations order by id desc limit 10;"
```

In Codex, verify `mcp-search` can search or fetch a known observation when the
MCP tool is available.

If `sqlite3` is not installed, do not block the whole validation on the SQL
queries. Report `sqlite3=missing`, verify the database file exists, and rely on
worker health, logs, MCP search, and a fresh observation write until `sqlite3`
can be installed:

```bash
command -v sqlite3 || printf 'sqlite3=missing\n'
test -f ~/.claude-mem/claude-mem.db && printf 'database=present\n'
```

7. Start a fresh Codex session and run the warm-up prompt.

Expected result: exact `Ready.`, with no hook JSON error, hook exit-code error,
or `unsupported suppressOutput` message. If human-readable Codex output still
shows one aggregate `SessionStart Failed`, collect JSON-mode output and direct
hook-script exit codes before deciding the runtime is broken. The model reply
can be `Ready.` while one best-effort context hook failed open.

## Runtime Verification

Prefer these checks over startup warnings.

Health:

```bash
jq '{pid,port,startedAt}' ~/.claude-mem/worker.pid

for port in 37701 37777; do
  printf 'checking_port=%s\n' "$port"
  curl -fsS "http://127.0.0.1:${port}/api/health" | jq . || true
done

ps -axo pid,command | grep -E 'claude-mem|worker-service' | grep -v grep || true
```

Expected:

```json
{
  "status": "ok"
}
```

At least one candidate port, the port recorded in `worker.pid`, or a
discovered worker process should explain where the worker is running. If both
candidate ports fail but a worker process exists, inspect its environment,
settings, and logs before reinstalling.

On shared machines, match the health `workerPath`, `worker.pid`, and process
owner to the current account. Do not reuse a different user's healthy
`claude-mem` worker as evidence for this account.

Settings without secrets:

```bash
jq '{
  CLAUDE_MEM_PROVIDER,
  CLAUDE_MEM_MODEL,
  CLAUDE_MEM_OPENROUTER_MODEL,
  CLAUDE_MEM_WORKER_HOST,
  CLAUDE_MEM_WORKER_PORT,
  CLAUDE_MEM_CODEX_TRANSCRIPT_INGESTION,
  has_openrouter_key: (.CLAUDE_MEM_OPENROUTER_API_KEY | type == "string" and length > 0),
  openrouter_key_length: (.CLAUDE_MEM_OPENROUTER_API_KEY | if type == "string" then length else 0 end)
}' ~/.claude-mem/settings.json
```

MCP and plugin state:

```bash
codex mcp list
codex plugin list
```

Expected local highlights:

```text
mcp-search      enabled
claude-mem@claude-mem-local installed, enabled, 13.4.0
```

Do not confuse the marketplace snapshot path shown by `codex plugin list` with
the active installed runtime cache. Verify active code through the worker
health `workerPath` and the cache path under `~/.codex/plugins/cache/...`.

Queue:

```bash
sqlite3 ~/.claude-mem/claude-mem.db \
  "select status, count(*) from pending_messages group by status;"
```

Recent observations:

```bash
sqlite3 -header -column ~/.claude-mem/claude-mem.db \
  "select id,type,title,created_at from observations order by id desc limit 20;"
```

Logs:

```bash
tail -n 160 ~/.claude-mem/logs/claude-mem-$(date +%Y-%m-%d).log 2>/dev/null |
  rg 'OpenRouter API usage|provider|QUEUE|STORED|PARSER|poison|failed|aborted|hook codex'
```

## Active Hook Shape

Current local `hooks/codex-hooks.json` keys on 2026-06-08:

```text
SessionStart
UserPromptSubmit
PostToolUse
Stop
```

The active `PostToolUse` path uses an async spool helper:

```text
scripts/codex-hook-spool.cjs
```

The active cache also contains:

```text
scripts/codex-hook-drain.cjs
scripts/codex-hook-mode.cjs
```

These files are part of current local runtime behavior. If an in-repo overlay
does not contain them, do not apply that overlay blindly with `rsync`; it will
regress the active hook topology.

Inspect active hook keys:

```bash
PLUGIN=$(ls -dt ~/.codex/plugins/cache/claude-mem-local/claude-mem/[0-9]* 2>/dev/null | head -1)
jq '.hooks | keys' "$PLUGIN/hooks/codex-hooks.json"
```

## Plugin Cache Drift

Active installed cache:

```text
~/.codex/plugins/cache/claude-mem-local/claude-mem/13.4.0/
```

Marketplace snapshot:

```text
~/.codex/.tmp/marketplaces/claude-mem-local/plugin/
```

The installed cache is the runtime verification target. The marketplace
snapshot alone is not sufficient evidence.

Current 2026-06-08 active checksums:

```text
scripts/worker-service.cjs      08406909758972eeaf8b95883e41f540b997d4e90d6badd76407f62f0b87ab1c
modes/code.json                 77b1755e13bf52e1f4382e6650df6fe7df8f4d14aaac6abbd31db2ef4d28354b
hooks/codex-hooks.json          71041823dab4435c5f49fe1c58c794d774ffafaf62bb9e9556920e3a67add57f
hooks/hooks.json                a0607dde6f87080b740fc394f1f08379ec453ea95a801d30451df11eed9b5c53
scripts/transcript-watcher.cjs  a25cc63bfff5ad520b3eba00dac3150d0804a7b13b29c6c71c1c753f529c2b33
.mcp.json                       bcbfabb39432fed47e9970f607e761f2c30b74eef3197dbaa0216feb5d24f304
package.json                    deba50feb85520007901bee93aa7625e329e6798d52937285fd252c7f5facfb1
```

Syntax and hook checks:

```bash
PLUGIN=$(ls -dt ~/.codex/plugins/cache/claude-mem-local/claude-mem/[0-9]* 2>/dev/null | head -1)
node --check "$PLUGIN/scripts/worker-service.cjs"
node --check "$PLUGIN/scripts/transcript-watcher.cjs"
node --check "$PLUGIN/scripts/codex-hook-spool.cjs"
jq -e '.hooks.SessionStart and .hooks.UserPromptSubmit and .hooks.PostToolUse and .hooks.Stop' \
  "$PLUGIN/hooks/codex-hooks.json" >/dev/null
! rg -n 'suppressOutput:!0|suppressOutput:true|"suppressOutput":true' \
  "$PLUGIN/scripts/worker-service.cjs" \
  "$PLUGIN/hooks/codex-hooks.json" \
  "$PLUGIN/hooks/hooks.json"
```

## Provider Changes

Back up settings before any provider, model, or context-limit change:

```bash
cp ~/.claude-mem/settings.json ~/.claude-mem/settings.json.bak-$(date +%Y%m%d%H%M%S)
chmod 600 ~/.claude-mem/settings.json.bak-*
```

Do not print secret values.

Current preferred local state is `provider=claude` with an OpenRouter rollback
snapshot retained. If rolling back to OpenRouter, use the named backup snapshot
and verify health, queue, logs, and search afterward.

## Restart

Preferred:

```bash
npx claude-mem@latest restart
```

Fallback direct runner:

```bash
PLUGIN=$(ls -dt ~/.codex/plugins/cache/claude-mem-local/claude-mem/[0-9]* 2>/dev/null | head -1)
printf '{}' | node \
  "$PLUGIN/scripts/bun-runner.js" \
  "$PLUGIN/scripts/worker-service.cjs" \
  start
```

## Incident Mode

Use this when Codex is needed for operational work and hook latency makes the
session unsafe.

Known symptoms:

- Codex UI stays at `Running PostToolUse hooks`.
- Repeated hook processes remain after tool calls.
- Worker health is green, but synchronous Codex hooks still block or lag.

Stable remediation is more important than capturing every observation. For an
incident session, temporarily disable high-volume hooks or the plugin, restart
Codex, and restore hooks after remediation.

Disable `PostToolUse` only:

```bash
PLUGIN=$(ls -dt ~/.codex/plugins/cache/claude-mem-local/claude-mem/[0-9]* 2>/dev/null | head -1)
cp "$PLUGIN/hooks/codex-hooks.json" \
  "$PLUGIN/hooks/codex-hooks.json.bak-incident-$(date +%Y%m%d%H%M%S)"
jq 'del(.hooks.PostToolUse)' "$PLUGIN/hooks/codex-hooks.json" > /tmp/codex-hooks.json
mv /tmp/codex-hooks.json "$PLUGIN/hooks/codex-hooks.json"
jq '.hooks | keys' "$PLUGIN/hooks/codex-hooks.json"
```

Restart Codex after editing hook files. Hook files are loaded when the session
starts.

Restore:

```bash
PLUGIN=$(ls -dt ~/.codex/plugins/cache/claude-mem-local/claude-mem/[0-9]* 2>/dev/null | head -1)
ls -t "$PLUGIN"/hooks/codex-hooks.json.bak-incident-* | head
cp <backup-file> "$PLUGIN/hooks/codex-hooks.json"
jq '.hooks | keys' "$PLUGIN/hooks/codex-hooks.json"
```

If hook issues continue, disable the plugin for that incident session:

```toml
[plugins."claude-mem@claude-mem-local"]
enabled = false
```

## Quality Guidance

`claude-mem` observations are historical evidence, not final project truth.
Good rows record durable changes, decisions, findings, root causes, and
validation. Bad rows record routine health checks, directory listings, generic
command execution, or repeated no-op warm-up turns.

If quality drops:

```bash
sqlite3 -header -column ~/.claude-mem/claude-mem.db \
  "select id,type,title,substr(narrative,1,120) as narrative from observations order by id desc limit 30;"
```

Look for:

```text
invalid type fallback
routine health/check noise
prose/no XML empty-turn responses
invented taxonomy names
repeated session initialization rows
```

Tune prompts, parser aliases, or narrowly scoped skip logic only after checking
real examples. Avoid broad skip rules that would drop useful incident evidence.

## Public Export Note

This public export intentionally includes only the Codex + `claude-mem`
handoff runbook and the reviewed `claude-mem` 13.4.0 Codex overlay assets.
Optional private-workstation Obsidian runbooks and historical incident
handover notes are not included.
