# Codex Plugin Validation Prompt

Use this prompt on a target workstation:

```text
You are installing, updating, or validating Codex plugins on this workstation.

Start by reading one of these public mirrors:

https://github.com/pitimon/exp-myCodex
https://gitea.ipv9.me/pitimon/exp-myCodex

Then read:

1. docs/README.md
2. docs/manifests/codex-plugins.yaml
3. the relevant per-plugin runbook under docs/runbooks/plugins/
4. for claude-mem, the latest comments in
   https://github.com/pitimon/exp-myCodex/issues/5

Goal:
Bootstrap, update, or validate the requested Codex plugin(s) using the public
runbooks, manifests, and live issue errata.

Default scope:

- If the user does not specify plugins, validate the Codex workstation baseline:
  claude-mem, 8-habit-ai-dev, claude-governance, TokenTracker, RTK, and
  Obsidian only where each tool is relevant and available.
- For a new machine, clone or otherwise create a local working copy of this
  repository before running helper scripts. Do not run helper commands from a
  browser-only view.
- For claude-mem, treat issue #5 as a live errata thread. Read the latest
  relevant comments before applying a workaround or declaring the runtime
  healthy.

Important constraints:

- Do not print API keys, OAuth tokens, bearer tokens, private keys, kubeconfigs, passwords, or sensitive local data.
- When checking local settings that may contain secrets, print only secret presence and secret length.
- Do not use or reference private repositories.
- Do not call a plugin healthy until its runbook verification passes.
- If a plugin requires a runtime overlay, verify the plugin version and active installed cache path before applying it.
- Do not apply an overlay for a different claude-mem version. If the active
  version has no exact overlay, report discovery mode and use issue #5 only for
  version-specific workaround guidance.
- Restart Codex after plugin or hook changes.
- On SSH, Linux, WSL, or NVM-based machines, verify `codex`, `node`, and `npx` are available in the shell that runs validation. Source `~/.nvm/nvm.sh` or use absolute paths when needed.
- If `rg` is unavailable, use `grep` for the same targeted checks or report `ripgrep=missing`; do not fail the whole validation only because `rg` is absent.

For claude-mem specifically:

- Start with docs/runbooks/plugins/claude-mem.md.
- Read https://github.com/pitimon/exp-myCodex/issues/5 and summarize any
  comments newer than this repository's current runbook baseline before making
  Codex hook changes.
- If the goal is to test the runbook itself, also run docs/runbooks/claude-mem-scenario-tests.md and report which scenarios passed, failed, or were skipped.
- Prefer installing and validating claude-mem with Claude Code first, then use the Codex plugin to connect Codex to the already-working worker.
- Before any Codex-side install or overlay, run the runbook's Recommended Claude Code First Preflight and report whether the claude-mem worker is already healthy.
- Check both common claude-mem health ports, 37701 and 37777, but do not accept a healthy HTTP response by itself. Match the health `workerPath`, `~/.claude-mem/worker.pid`, settings port, process owner, and version to the current user.
- Do not treat the marketplace snapshot path as the active runtime path.
- Verify active runtime through worker health workerPath and the installed cache under ~/.codex/plugins/cache/.
- If `CLAUDE_MEM_CHROMA_ENABLED=true`, verify `uvx` is installed and visible to the worker. Install `uv/uvx` or explicitly report Chroma as skipped/unhealthy before calling vector search healthy.
- Verify `scripts/version-check.js` against the active Codex cache and check for `.install-version` there; do not assume the Claude Code cache marker applies to Codex.
- Prefer `node scripts/claude-mem-codex-compat.cjs inspect|apply|verify --json` from this repo for version-aware overlay handling.
- If applying the local overlay, match the active claude-mem version to the overlay directory.
- If no overlay exists for the active claude-mem version, do not apply an older overlay. Report `overlay=missing_for_version:<version>` and run the runbook's Version Drift Policy discovery checks.
- Inspect both hook layers:
  `~/.codex/hooks.json` and `<active-plugin>/hooks/codex-hooks.json`.
- Treat hook commands that exit 0 with empty stdout as suspicious when Codex
  expects hook JSON.
- If user-level hooks pipe through `scripts/codex-hook-output-filter.js`, verify
  that file exists in the plugin root the hook command resolves at runtime.
- If duplicate `SessionStart` version-check hooks exist, keep a resilient hook
  that returns `{"continue":true}` and report any duplicate plugin-owned hook
  that exits with empty stdout.
- For claude-mem 13.4.0, run `node "$PLUGIN/scripts/codex-hook-mode.cjs" balanced` after applying the overlay.
- For claude-mem 13.6.2, keep the Codex marketplace pinned to `v13.6.2` plus the reviewed local overlay until upstream publishes an equivalent Codex-compatible bundle.
- For claude-mem 13.6.2, verify `hooks/codex-hooks.json` has only the top-level `hooks` key; Codex 0.140 rejects a top-level `description` key.
- For claude-mem 13.6.2, apply the minimal overlay to all live-resolvable roots when present: Codex local marketplace snapshot, Codex cache, Codex staging roots, Claude cache, and Claude marketplace.
- For claude-mem 13.6.2, verify hook commands prefer 13.6.2 Codex/local roots before older Claude cache fallbacks, and that worker health reports version 13.6.2.
- For legacy claude-mem 13.4.2, keep the Codex marketplace pinned to `v13.4.2` unless a newer reviewed overlay exists.
- For claude-mem 13.4.2, apply the minimal overlay to all live-resolvable roots when present: Codex cache, Codex marketplace snapshot, Claude cache, and Claude marketplace.
- For claude-mem 13.4.2, verify the Codex `SessionStart`, `PreToolUse`, and `PostToolUse` hook outputs do not contain top-level `suppressOutput`; the overlay includes `scripts/codex-hook-output-filter.js`.
- To validate recent-context injection, run the runbook's Codex-shaped `SessionStart` payload probe. Do not use `{}` as the probe payload.
- Run the Post-Install And Post-Update Verification section before calling healthy.
- If `sqlite3` is missing, report that exact skip and use worker health, logs, MCP search, and observation-write evidence instead of pretending SQL verification passed.
- A warm-up reply of exact `Ready.` is necessary but not sufficient. If Codex human-readable output shows an aggregate `SessionStart Failed`, collect direct hook-script checks and JSON-mode Codex output and report the residual warning.
- Final acceptance requires two `codex exec` lifecycle smokes:
  startup-only and tool-triggering. The tool-triggering smoke must exercise
  `PreToolUse` and `PostToolUse`; do not call claude-mem healthy from a warm-up
  prompt alone.

For TokenTracker specifically:

- Use docs/runbooks/tools/tokentracker.md.
- On Linux systemd user services, set both absolute `npx` in `ExecStart=` and `Environment=PATH=<node-dir>:/usr/local/bin:/usr/bin:/bin`, especially for NVM/Volta/asdf Node installs.
- Verify `systemctl --user` state, dashboard HTTP 200, and `npx --yes @ipv9/tokentracker-cli@0.39.6 doctor --json`.

For RTK specifically:

- Use docs/runbooks/tools/rtk.md.
- If Homebrew is unavailable, use the official `rtk-ai/rtk` installer with the manifest version, add `~/.local/bin` to `PATH`, and smoke test `rtk --version`, `rtk gain`, and `rtk proxy echo ok`.
- Do not install the global shell hook with `rtk init -g` unless the user explicitly wants automatic shell integration.

For Obsidian specifically:

- Use docs/runbooks/tools/obsidian.md.
- Treat Obsidian as an optional curated second-brain layer, not proof that claude-mem is healthy.
- Keep raw captures under `Codex/Inbox/` and promote only durable summaries, decisions, lessons, and runbooks into `Claude-Mem/Projects/<project>/`.
- Rebuild and verify the project `Index.md` after adding or updating a project note.
- Do not store raw transcripts, secrets, customer-sensitive data, or private operational logs in Obsidian.

Expected final response:
Provide a concise validation report with:

- plugin marketplace state
- installed plugin version(s)
- active plugin cache path(s), when relevant
- Codex plugin-list path, versioned cache path, staging roots, and user-level hook file status, when relevant
- MCP availability, when relevant
- hook/helper status, when relevant
- exact overlay/workaround used, or `overlay=missing_for_version:<version>`
- claude-mem worker health, port ownership/path, and Chroma/uvx state, when relevant
- TokenTracker package/version, service state, dashboard health, and doctor warnings, when relevant
- RTK version, install path, and smoke-test result, when relevant
- Obsidian vault access, project note path, index rebuild result, and curation boundary, when relevant
- release URL or verified version used
- validation commands run
- issue #5 comments consulted and whether a new issue comment should be added
- any remaining risk or manual follow-up
```
