# Codex Handoff

This directory documents public-safe setup and validation flows from a real
Codex workstation setup. The intent is to help other people prepare Codex with
memory, workflow, verification, and token-efficiency habits from day one.

## Quick Start

For a target workstation, use:

```text
docs/prompts/codex-plugin-validation-prompt.md
```

Public mirrors:

```text
https://github.com/pitimon/exp-myCodex
https://gitea.ipv9.me/pitimon/exp-myCodex
```

For exact plugin commands, read the per-plugin runbook:

```text
docs/runbooks/plugins/8-habit-ai-dev.md
docs/runbooks/plugins/claude-governance.md
docs/runbooks/plugins/claude-mem.md
```

For validating the `claude-mem` runbook against a real workstation, use:

```text
docs/runbooks/claude-mem-scenario-tests.md
```

For non-plugin tooling, read:

```text
docs/runbooks/tools/obsidian.md
docs/runbooks/tools/changes-log-bridge.md
docs/runbooks/tools/rtk.md
docs/runbooks/tools/tokentracker.md
```

For version-aware compatibility helpers, read:

```text
scripts/claude-mem-codex-compat.cjs
```

For a compact inventory, read:

```text
docs/manifests/codex-plugins.yaml
docs/manifests/codex-tools.yaml
docs/manifests/public-mirrors.yaml
docs/manifests/verified-versions.yaml
```

## Rules

- Do not publish private machine paths, customer context, kubeconfigs, API keys,
  OAuth tokens, bearer tokens, private keys, or passwords here.
- Prefer public release URLs and plugin selectors over private issue links.
- Keep one runbook per plugin.
- Keep one runbook per reusable CLI/tool.
- Keep Obsidian notes curated and project-indexed; do not publish raw
  transcript dumps as reusable memory.
- Keep reusable prompts in `docs/prompts/`.
- Keep runtime overlays in `overlays/<plugin>/<version>/`.
- Keep executable compatibility helpers in `scripts/`.
- Write from verified runtime behavior when possible, not from repository state
  alone.
