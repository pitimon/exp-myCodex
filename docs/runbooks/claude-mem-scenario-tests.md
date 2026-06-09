# claude-mem Codex Scenario Tests

Date: 2026-06-08
Status: Public scenario checklist for validating the runbook on a real workstation

## Purpose

Use this checklist when a workstation is intentionally testing the
`claude-mem` Codex runbook, not merely installing the plugin. The goal is to
find missing instructions, stale assumptions, and unsafe shortcuts before other
machines reuse the docs.

Start with the read-only scenarios. Run state-changing scenarios only when the
operator explicitly wants to test reinstall, overlay, or incident recovery
behavior.

## Rules

- Do not print secret values from `~/.claude-mem/settings.json`.
- Do not treat a healthy HTTP response as sufficient worker proof on shared
  hosts. Match port, `workerPath`, process owner, and `~/.claude-mem/worker.pid`.
- Do not apply an overlay unless its directory exactly matches the active Codex
  plugin cache version.
- Record skipped checks explicitly, for example `sqlite3=missing` or
  `ripgrep=missing`.
- Restart Codex after any hook or plugin file change before judging session
  startup behavior.

## Read-Only Scenarios

### 1. Toolchain Preflight

Verify the shell used for validation can see the tools the runbook expects:

```bash
date -Is
command -v node && node --version
command -v codex || true
command -v npx || true
command -v jq || true
command -v rg || command -v grep || true
command -v sqlite3 || printf 'sqlite3=missing\n'
command -v uvx || command -v uv || true
```

Expected: `node`, `codex`, `npx`, and `jq` are available. Missing `sqlite3` is
allowed only if the validator reports the skip and uses worker health, logs, MCP
search, and fresh observation evidence instead.

### 2. Plugin And MCP Inventory

```bash
codex plugin list
codex mcp list
```

Expected:

- `claude-mem@claude-mem-local` is installed and enabled.
- `mcp-search` is enabled.
- The marketplace path shown by `codex plugin list` is not treated as the active
  installed cache.

### 3. Compatibility Helper

Run this from the `exp-myCodex` repo root:

```bash
node scripts/claude-mem-codex-compat.cjs inspect --json
node scripts/claude-mem-codex-compat.cjs verify --json
```

Expected:

- `activePlugin` points under `~/.codex/plugins/cache/...`.
- `overlayExists` is true when the active version has a reviewed overlay.
- `installMarkerExists` is true.
- hook files include `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
  `PostToolUse`, and `Stop`.
- `hasUnsupportedSuppressOutput` is false.
- `skillDescriptionIssues` is empty.
- `verify` returns `ok=true`.

If `overlayExists=false`, do not apply an older overlay. Report
`overlay=missing_for_version:<version>` and keep the workstation in discovery
mode.

### 4. Worker Ownership And Port Match

```bash
test -f ~/.claude-mem/worker.pid && jq '{pid,port,startedAt}' ~/.claude-mem/worker.pid || true

for port in 37701 37777; do
  printf 'checking_port=%s\n' "$port"
  curl -fsS "http://127.0.0.1:${port}/api/health" | jq '{status,version,workerPath}' || true
done

ps -axo pid,user,command | grep -E 'claude-mem|worker-service' | grep -v grep || true
```

Expected:

- At least one reachable health endpoint matches the current user's worker.
- A healthy endpoint owned by another account is reported as foreign and is not
  counted as this account's runtime.
- `worker.pid` explains the expected port or the validator records why it cannot
  be trusted.

### 5. Settings And Chroma Without Secrets

```bash
if [ -f ~/.claude-mem/settings.json ]; then
  jq '{
    CLAUDE_MEM_PROVIDER,
    CLAUDE_MEM_MODEL,
    CLAUDE_MEM_WORKER_HOST,
    CLAUDE_MEM_WORKER_PORT,
    CLAUDE_MEM_CODEX_TRANSCRIPT_INGESTION,
    CLAUDE_MEM_CHROMA_ENABLED,
    has_openrouter_key: (.CLAUDE_MEM_OPENROUTER_API_KEY | type == "string" and length > 0),
    openrouter_key_length: (.CLAUDE_MEM_OPENROUTER_API_KEY | if type == "string" then length else 0 end)
  }' ~/.claude-mem/settings.json
fi

command -v uvx || command -v uv || true
tail -n 160 ~/.claude-mem/logs/claude-mem-$(date +%Y-%m-%d).log 2>/dev/null |
  rg 'CHROMA|uvx|chroma-mcp|Executable not found|Connected to chroma-mcp' || true
```

Expected: secret presence and length only. If Chroma is enabled, `uvx` or `uv`
must be visible and logs should show either Chroma activity or a clear failure
to report.

### 6. Database Fallback

```bash
command -v sqlite3 || printf 'sqlite3=missing\n'
test -f ~/.claude-mem/claude-mem.db && printf 'database=present\n' || printf 'database=missing\n'
```

If `sqlite3` exists, also run the queue and recent-observation SQL queries from
the main runbook. If `sqlite3` is missing, do not fake SQL validation.

### 7. Recent Context Payload Probe

Use a Codex-shaped `SessionStart` payload. Do not use `{}` for this scenario.

```bash
PLUGIN=$(node scripts/claude-mem-codex-compat.cjs inspect --json | jq -r '.activePlugin')
test -n "$PLUGIN" && test "$PLUGIN" != "null" && test -d "$PLUGIN"

PAYLOAD=$(mktemp)
cat > "$PAYLOAD" <<JSON
{"session_id":"codex-context-probe","hook_event_name":"SessionStart","cwd":"$PWD","source":"startup","transcript_path":"/tmp/codex-context-probe.jsonl"}
JSON

cat "$PAYLOAD" |
  node "$PLUGIN/scripts/bun-runner.js" \
    "$PLUGIN/scripts/worker-service.cjs" \
    hook codex context |
  jq '{
    has_systemMessage: (.systemMessage | type == "string" and length > 0),
    has_additionalContext: (.hookSpecificOutput.additionalContext | type == "string" and length > 0),
    preview: ((.hookSpecificOutput.additionalContext // .systemMessage // "") | split("\n")[0:4])
  }'

rm -f "$PAYLOAD"
```

Expected: `has_systemMessage=true` or `has_additionalContext=true`. For a
project with stored observations, the preview should start with the
recent-context heading. For a new or empty project, `# claude-mem status` is also
valid because it proves the hook produced a Codex context payload even though no
project memory exists yet. If the probe fails, collect the raw hook output and
worker logs before reinstalling anything.

### 8. Warm-Up Session

Start a fresh Codex session and make the first user message exactly:

```text
Session warm-up only. Load configured startup context and initialize hooks. Do not run tools, inspect files, or modify anything. Reply exactly: Ready.
```

Expected: exact `Ready.` with no hook JSON error, unsupported `suppressOutput`,
or `SessionStart Failed`. If the human-readable output shows an aggregate
`SessionStart Failed`, compare it with JSON-mode output and the payload probe
before declaring the runtime unhealthy.

## State-Changing Scenarios

Run these only after the read-only scenarios pass or after the operator decides
to test recovery behavior.

### 9. Overlay Apply And Marketplace Snapshot

```bash
node scripts/claude-mem-codex-compat.cjs inspect --json
node scripts/claude-mem-codex-compat.cjs apply --json
node scripts/claude-mem-codex-compat.cjs verify --json
```

Expected:

- Existing target files are backed up with `.bak-compat-<timestamp>`.
- The overlay is applied to the active Codex cache, Codex marketplace snapshot,
  Claude cache, and Claude marketplace when those roots exist.
- `verify` returns `ok=true`.
- Codex is restarted before evaluating startup behavior.

### 10. Remove/Add Update Path

Use only after backing up settings and active hook files as described in the
main runbook.

```bash
codex plugin marketplace upgrade claude-mem-local
codex plugin remove claude-mem@claude-mem-local
codex plugin add claude-mem@claude-mem-local
node scripts/claude-mem-codex-compat.cjs inspect --json
node scripts/claude-mem-codex-compat.cjs apply --json
node scripts/claude-mem-codex-compat.cjs verify --json
```

Expected: the active cache path is rediscovered, the version is documented, and
no old overlay is applied unless the exact-version overlay exists.

### 11. Incident Hook Disable And Restore

Follow the main runbook's Incident Mode section to disable only `PostToolUse`,
restart Codex, verify the session is responsive, then restore the backed-up
hook file and restart Codex again.

Expected: the runbook contains enough information to return to the original
hook set without guessing which file to restore.

## Report Template

```text
Scenario test date:
Host/user class: single-user | shared-host | WSL | SSH | other
Codex version:
claude-mem Codex plugin version:
claude-mem worker version:
Active Codex cache:
Worker health ports:
Foreign worker ports:
MCP state:
sqlite3: present | missing
uv/uvx: present | missing
Chroma state:
Context payload probe: pass | fail
Warm-up: pass | fail | skipped
State-changing scenarios run: none | overlay | remove-add | incident
Runbook gaps found:
Follow-up issues/PRs:
```
