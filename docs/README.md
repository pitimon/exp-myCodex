# Codex Plugin Handoff

This directory documents public-safe setup and validation flows for Codex
plugins.

## Quick Start

For a target workstation, use:

```text
docs/prompts/codex-plugin-validation-prompt.md
```

For exact plugin commands, read the per-plugin runbook:

```text
docs/runbooks/plugins/8-habit-ai-dev.md
docs/runbooks/plugins/claude-governance.md
docs/runbooks/plugins/claude-mem.md
```

For a compact inventory, read:

```text
docs/manifests/codex-plugins.yaml
docs/manifests/verified-versions.yaml
```

## Rules

- Do not publish private machine paths, customer context, kubeconfigs, API keys,
  OAuth tokens, bearer tokens, private keys, or passwords here.
- Prefer public release URLs and plugin selectors over private issue links.
- Keep one runbook per plugin.
- Keep reusable prompts in `docs/prompts/`.
- Keep runtime overlays in `overlays/<plugin>/<version>/`.
