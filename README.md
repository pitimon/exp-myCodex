# exp-myCodex

Public Codex setup notes, runbooks, and manifests from a real workstation.

`exp-myCodex` is a public-safe knowledge base for people who want to prepare
Codex beyond a default install: memory integration, plugin hygiene, runtime
verification, workflow discipline, and token-aware tooling.

The material here comes from practical setup and maintenance work. It is
curated for sharing, so private infrastructure details, secrets, raw
transcripts, and machine-specific incident records are intentionally excluded.

## Who This Is For

- Codex users who want a repeatable setup checklist.
- Operators maintaining Codex plugins across machines.
- Teams evaluating memory, governance, and workflow plugins for AI-assisted
  engineering.
- Friends and community members who want to reuse the lessons without reading a
  private operations repo.

## Quick Start

Start with the documentation index:

```text
docs/README.md
```

Then use the reusable validation prompt on the target workstation:

```text
docs/prompts/codex-plugin-validation-prompt.md
```

The prompt tells the target agent to read the public repo, follow the relevant
runbooks, verify the active runtime, and avoid printing secrets.

## What Is Included

| Area | Purpose | Start Here |
| --- | --- | --- |
| Codex plugin setup | Install, update, and validate Codex plugins | `docs/runbooks/plugins/` |
| `claude-mem` memory | Codex memory hooks, worker checks, and overlay guidance | `docs/runbooks/plugins/claude-mem.md` |
| 8-Habit AI Dev | Workflow discipline for AI-assisted engineering | `docs/runbooks/plugins/8-habit-ai-dev.md` |
| Claude Governance | Governance and compliance-oriented skills | `docs/runbooks/plugins/claude-governance.md` |
| TokenTracker | Token and cost visibility for AI coding tools | `docs/runbooks/tools/tokentracker.md` |
| RTK | Token-optimized shell command proxy | `docs/runbooks/tools/rtk.md` |
| Manifests | Machine-readable plugin, tool, mirror, and version inventory | `docs/manifests/` |
| Runtime overlays | Reviewed local patch overlays when a plugin needs them | `overlays/` |

## Repository Map

```text
docs/
  README.md
  manifests/
    codex-plugins.yaml
    codex-tools.yaml
    public-mirrors.yaml
    verified-versions.yaml
  prompts/
    codex-plugin-validation-prompt.md
  runbooks/
    plugins/
    tools/
overlays/
  claude-mem/13.4.0/
```

## Operating Principles

- Verify current runtime state before declaring a setup healthy.
- Check active plugin versions, active cache paths, service health, and command
  output instead of relying on repository state alone.
- Keep instructions reproducible with exact package selectors, update commands,
  verification checks, and rollback hints.
- Keep shared docs public-safe: no secrets, private issue links, raw
  transcripts, or customer-sensitive material.
- Treat token usage as an operational concern. TokenTracker and RTK are included
  because long Codex sessions need visibility and output discipline.

## Public Mirrors

This repo is intended to remain public in both locations:

```text
https://github.com/pitimon/exp-myCodex
https://gitea.ipv9.me/pitimon/exp-myCodex
```

Mirror metadata lives in:

```text
docs/manifests/public-mirrors.yaml
```

## Contributing

Contributions are welcome when they improve public, reproducible Codex setup
knowledge.

Good contributions:

- add or correct installation and verification steps
- update version manifests after confirming public release state
- improve cross-platform instructions
- add troubleshooting notes backed by observed behavior

Please avoid:

- private URLs or issue links
- secrets, tokens, credentials, kubeconfigs, or raw transcripts
- machine-specific paths unless they are clearly examples
- unverified claims about active plugin/runtime behavior

## License

MIT. See `LICENSE`.
