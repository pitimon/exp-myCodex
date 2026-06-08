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

Goal:
Install, update, or validate the requested Codex plugin(s) using the public runbooks and manifests.

Important constraints:

- Do not print API keys, OAuth tokens, bearer tokens, private keys, kubeconfigs, passwords, or sensitive local data.
- When checking local settings that may contain secrets, print only secret presence and secret length.
- Do not use or reference private repositories.
- Do not call a plugin healthy until its runbook verification passes.
- If a plugin requires a runtime overlay, verify the plugin version and active installed cache path before applying it.
- Restart Codex after plugin or hook changes.
- On SSH, Linux, WSL, or NVM-based machines, verify `codex`, `node`, and `npx` are available in the shell that runs validation. Source `~/.nvm/nvm.sh` or use absolute paths when needed.
- If `rg` is unavailable, use `grep` for the same targeted checks or report `ripgrep=missing`; do not fail the whole validation only because `rg` is absent.

For claude-mem specifically:

- Start with docs/runbooks/plugins/claude-mem.md.
- Prefer installing and validating claude-mem with Claude Code first, then use the Codex plugin to connect Codex to the already-working worker.
- Before any Codex-side install or overlay, run the runbook's Recommended Claude Code First Preflight and report whether the claude-mem worker is already healthy.
- Check both common claude-mem health ports, 37701 and 37777, but do not accept a healthy HTTP response by itself. Match the health `workerPath`, `~/.claude-mem/worker.pid`, settings port, process owner, and version to the current user.
- Do not treat the marketplace snapshot path as the active runtime path.
- Verify active runtime through worker health workerPath and the installed cache under ~/.codex/plugins/cache/.
- If `CLAUDE_MEM_CHROMA_ENABLED=true`, verify `uvx` is installed and visible to the worker. Install `uv/uvx` or explicitly report Chroma as skipped/unhealthy before calling vector search healthy.
- If applying the local overlay, require claude-mem version 13.4.0 and then run:
  node "$PLUGIN/scripts/codex-hook-mode.cjs" balanced
- Run the Post-Install And Post-Update Verification section before calling healthy.
- If `sqlite3` is missing, report that exact skip and use worker health, logs, MCP search, and observation-write evidence instead of pretending SQL verification passed.
- A warm-up reply of exact `Ready.` is necessary but not sufficient. If Codex human-readable output shows an aggregate `SessionStart Failed`, collect direct hook-script checks and JSON-mode Codex output and report the residual warning.

For TokenTracker specifically:

- Use docs/runbooks/tools/tokentracker.md.
- On Linux systemd user services, set both absolute `npx` in `ExecStart=` and `Environment=PATH=<node-dir>:/usr/local/bin:/usr/bin:/bin`, especially for NVM/Volta/asdf Node installs.
- Verify `systemctl --user` state, dashboard HTTP 200, and `npx --yes @ipv9/tokentracker-cli@0.39.6 doctor --json`.

For RTK specifically:

- Use docs/runbooks/tools/rtk.md.
- If Homebrew is unavailable, use the official `rtk-ai/rtk` installer with the manifest version, add `~/.local/bin` to `PATH`, and smoke test `rtk --version`, `rtk gain`, and `rtk proxy echo ok`.
- Do not install the global shell hook with `rtk init -g` unless the user explicitly wants automatic shell integration.

Expected final response:
Provide a concise validation report with:

- plugin marketplace state
- installed plugin version(s)
- active plugin cache path(s), when relevant
- MCP availability, when relevant
- hook/helper status, when relevant
- claude-mem worker health, port ownership/path, and Chroma/uvx state, when relevant
- TokenTracker package/version, service state, dashboard health, and doctor warnings, when relevant
- RTK version, install path, and smoke-test result, when relevant
- release URL or verified version used
- validation commands run
- any remaining risk or manual follow-up
```
