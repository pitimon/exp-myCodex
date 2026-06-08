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

For claude-mem specifically:

- Start with docs/runbooks/plugins/claude-mem.md.
- Prefer installing and validating claude-mem with Claude Code first, then use the Codex plugin to connect Codex to the already-working worker.
- Before any Codex-side install or overlay, run the runbook's Recommended Claude Code First Preflight and report whether the claude-mem worker is already healthy.
- Do not treat the marketplace snapshot path as the active runtime path.
- Verify active runtime through worker health workerPath and the installed cache under ~/.codex/plugins/cache/.
- If applying the local overlay, require claude-mem version 13.4.0 and then run:
  node "$PLUGIN/scripts/codex-hook-mode.cjs" balanced
- Run the Post-Install And Post-Update Verification section before calling healthy.

Expected final response:
Provide a concise validation report with:

- plugin marketplace state
- installed plugin version(s)
- active plugin cache path(s), when relevant
- MCP availability, when relevant
- hook/helper status, when relevant
- release URL or verified version used
- validation commands run
- any remaining risk or manual follow-up
```
