# exp-myCodex

Public notes from my Codex setup work.

The goal of this repo is to share a practical, public-safe Codex preparation
playbook for friends and other operators who want to use Codex with better
memory, workflow discipline, runtime verification, and token awareness.

This is not a polished product manual. It is a curated export of what worked on
real machines while preparing Codex, packaging plugins, validating active
runtime state, and fixing the rough edges that only show up after actual use.

Start here:

```text
docs/README.md
```

Public mirrors:

```text
https://github.com/pitimon/exp-myCodex
https://gitea.ipv9.me/pitimon/exp-myCodex
```

Primary plugin runbooks:

```text
docs/runbooks/plugins/claude-mem.md
docs/runbooks/plugins/8-habit-ai-dev.md
docs/runbooks/plugins/claude-governance.md
```

Extended tool runbooks:

```text
docs/runbooks/tools/tokentracker.md
docs/runbooks/tools/rtk.md
```

Machine-readable references:

```text
docs/manifests/codex-plugins.yaml
docs/manifests/codex-tools.yaml
docs/manifests/public-mirrors.yaml
docs/manifests/verified-versions.yaml
```

Reusable prompt:

```text
docs/prompts/codex-plugin-validation-prompt.md
```

Runtime overlays:

```text
overlays/claude-mem/13.4.0/
```

## Scope

This repo is a public-safe export. It is not a full operational history repo,
and it intentionally excludes private infrastructure notes, Obsidian vault
paths, private issue comments, and machine-specific incident records.

## Operating Principles

- Prefer current runtime truth over assumptions: inspect active plugin versions,
  active cache paths, service health, and command output before declaring a
  setup healthy.
- Keep install notes reproducible: include exact package selectors, update
  commands, verification checks, and rollback hints.
- Share only public-safe material: no secrets, private infrastructure details,
  private issue links, raw transcripts, or customer-sensitive data.
- Treat token usage as an operational concern: use TokenTracker and RTK where
  they help keep Codex sessions inspectable and efficient.
