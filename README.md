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

## How The Pieces Fit Together

```text
                         Public mirrors
             +------------------------------------+
             | GitHub: pitimon/exp-myCodex        |
             | Gitea : pitimon/exp-myCodex        |
             +------------------+-----------------+
                                |
                                v
                 +------------------------------+
                 | docs/ + manifests/ + prompts |
                 | public-safe setup knowledge  |
                 +---------------+--------------+
                                 |
                 target agent reads runbooks
                                 |
                                 v
+------------------------------------------------------------------+
|                              Codex                               |
|                                                                  |
|  +----------------------+   +-------------------------------+    |
|  | Plugin management    |   | Runtime verification          |    |
|  | codex plugin ...     |   | active cache, MCP, services   |    |
|  +----------+-----------+   +---------------+---------------+    |
|             |                               |                    |
|             v                               v                    |
|  +----------------------+      +-----------------------------+   |
|  | 8-Habit AI Dev       |      | claude-mem                  |   |
|  | workflow discipline  |      | memory hooks + mcp-search   |   |
|  +----------------------+      +---------------+-------------+   |
|                                                |                 |
|  +----------------------+                      v                 |
|  | Claude Governance    |      +-----------------------------+   |
|  | ADR/governance       |      | claude-mem worker + SQLite  |   |
|  +----------------------+      | historical agent memory      |   |
|                                +-----------------------------+   |
|                                                                  |
|  +----------------------+      +-----------------------------+   |
|  | RTK                  |      | TokenTracker                |   |
|  | compact command I/O  |      | token/cost visibility       |   |
|  +----------------------+      +-----------------------------+   |
+------------------------------------------------------------------+
                 ^
                 |
     overlays/ when a plugin needs a reviewed local patch
```

In short: this repo is the public handoff layer. Codex uses the runbooks and
manifests to install plugins, verify active runtime state, apply reviewed
overlays when needed, and add adjacent tools for token visibility and compact
command output.

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
| Compatibility helpers | Version-aware inspection, overlay apply, and verification scripts | `scripts/` |

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
  claude-mem/13.4.1/
scripts/
  claude-mem-codex-compat.cjs
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
