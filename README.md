# exp-myCodex

Public handoff materials for setting up or validating Codex + `claude-mem`.

Start here:

```text
docs/runbooks/codex-claude-mem-memory-runbook.md
```

The repository also includes the reviewed `claude-mem` 13.4.0 Codex overlay:

```text
docs/runbooks/assets/claude-mem-13.4.0-codex-local-patches/
```

## Operator Prompt

Use this prompt on the target workstation:

```text
You are setting up or validating Codex + claude-mem on this workstation.

Start by reading this canonical runbook:

https://gitea.ipv9.me/pitimon/exp-myCodex/src/branch/main/docs/runbooks/codex-claude-mem-memory-runbook.md

Goal:
Set up, update, or validate Codex + claude-mem so Codex can use mcp-search and the active claude-mem plugin hooks safely.

Follow this order from the runbook:

1. Current Verified State
2. Install claude-mem Plugin
3. Update claude-mem Plugin
4. Post-Install And Post-Update Verification
5. Warm-Up-Only Session Prompt
6. Active Hook Shape
7. Plugin Cache Drift
8. Incident Mode, only if hooks block or hang

Important constraints:

- Do not print or paste ~/.claude-mem/settings.json.
- Do not print API keys, OAuth tokens, bearer tokens, private keys, kubeconfigs, passwords, or customer-sensitive raw data.
- When checking settings, print only secret presence and secret length.
- Do not treat the marketplace snapshot path as the active runtime path.
- Verify active runtime through worker health workerPath and the installed cache under ~/.codex/plugins/cache/.
- Do not blindly rsync any overlay until the active plugin version and active cache path are confirmed.
- If applying the local overlay, require claude-mem version 13.4.0 and then run:
  node "$PLUGIN/scripts/codex-hook-mode.cjs" balanced
- Restart claude-mem and restart Codex after hook/plugin changes.
- Do not call the integration healthy until the runbook's Post-Install And Post-Update Verification passes.

Expected final response:
Provide a concise validation report with:

- plugin marketplace state
- installed claude-mem plugin version
- active plugin cache path
- worker health status
- provider/model state without secrets
- mcp-search availability
- active hook keys
- whether codex-hook-spool.cjs / drain / mode are present and syntax-valid
- whether unsupported suppressOutput is absent
- whether real search or MCP lookup works
- whether the warm-up-only prompt returns exactly Ready.
- any remaining risk or manual follow-up
```

## Scope

This repo is a public-safe export. It is not a full operational history repo,
and it intentionally excludes private infrastructure notes, Obsidian vault
paths, private issue comments, and machine-specific incident records.
