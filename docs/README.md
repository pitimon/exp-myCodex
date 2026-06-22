# Codex Handoff

This directory contains public-safe setup and validation flows from a real Codex
workstation. Use it to prepare another machine with memory, workflow,
verification, handoff, and token-efficiency habits from day one.

## Target-Machine Prompt

Start a new workstation with this prompt:

```text
Read https://github.com/pitimon/exp-myCodex

Then follow docs/prompts/codex-plugin-validation-prompt.md.
```

The same repository is mirrored at:

```text
https://github.com/pitimon/exp-myCodex
https://gitea.ipv9.me/pitimon/exp-myCodex
```

## Reading Order

1. `../README.md` - overall model, evidence standard, and public boundary.
2. `prompts/codex-plugin-validation-prompt.md` - copyable prompt for a target
   Codex session.
3. `manifests/codex-plugins.yaml` - plugin selectors, versions, and
   verification expectations.
4. `manifests/codex-tools.yaml` - adjacent tools such as RTK, TokenTracker, and
   Bridge.
5. `manifests/verified-versions.yaml` - current reviewed baseline and caveats.
6. `runbooks/tools/changes-log-bridge.md` - multi-agent CHANGES.log handoff
   setup.
7. `runbooks/plugins/claude-mem.md` - memory worker, hook, MCP, and overlay
   validation.
8. `runbooks/claude-mem-scenario-tests.md` - end-to-end scenario checks for the
   memory runbook.

## Runbook Index

Plugin runbooks:

```text
runbooks/plugins/8-habit-ai-dev.md
runbooks/plugins/claude-governance.md
runbooks/plugins/claude-mem.md
runbooks/plugins/template.md
```

Tool runbooks:

```text
runbooks/tools/changes-log-bridge.md
runbooks/tools/obsidian.md
runbooks/tools/rtk.md
runbooks/tools/tokentracker.md
```

Compatibility helper:

```text
../scripts/claude-mem-codex-compat.cjs
```

## Manifest Index

- `manifests/codex-plugins.yaml` records Codex plugin selectors, versions,
  sources, and smoke tests.
- `manifests/codex-tools.yaml` records non-plugin tools and workflow-only setup
  checks.
- `manifests/public-mirrors.yaml` records GitHub/Gitea publication targets and
  mirror policy.
- `manifests/verified-versions.yaml` records reviewed plugin/tool versions and
  known caveats.

## Validation Standard

Documentation should report runtime evidence, not just repository state. For
example:

- use `codex plugin list` for active plugin paths
- use `codex mcp list` and smoke queries for MCP availability
- use `git check-ignore -v CHANGES.log` for Bridge ignore proof
- use lifecycle `codex exec` smokes before calling `claude-mem` healthy
- record skipped checks explicitly instead of implying they passed

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
