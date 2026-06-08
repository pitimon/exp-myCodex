# exp-myCodex

Public, field-tested Codex setup notes for people who want a stronger starting
point than a default install.

This repository shares the practical Codex preparation work behind one real
workstation: plugin installation, memory integration, runtime verification,
version-drift handling, token visibility, and command-output discipline. It is
curated for public reuse, so private infrastructure details, secrets, raw
transcripts, and machine-specific incident records are intentionally excluded.

## Purpose

`exp-myCodex` is a public handoff repository. It is meant to help friends,
teams, and other Codex users reproduce the useful parts of this setup without
needing access to a private operations repo.

The repo focuses on:

- installing and validating Codex plugins from public sources
- connecting Codex to an already-working `claude-mem` worker
- detecting active plugin cache, MCP, worker, and service state before calling
  a setup healthy
- handling fast-moving plugin versions with exact-version overlays and
  compatibility checks
- adding token and output-discipline tools around Codex
- keeping all public documentation safe to share

This is not a one-command installer. Treat it as a tested runbook collection,
manifest set, and validation prompt that a target workstation can follow.

## Who This Is For

- Codex users preparing a repeatable personal workstation setup.
- Operators maintaining Codex plugins across multiple machines.
- Teams evaluating memory, governance, and workflow plugins for AI-assisted
  engineering.
- Maintainers who want public, reviewable examples of Codex plugin handoff
  documentation.

## Quick Start

On a target workstation, start with the docs index:

```text
docs/README.md
```

Then run the reusable validation prompt in Codex:

```text
docs/prompts/codex-plugin-validation-prompt.md
```

The prompt tells the target agent to read this repo, install or validate the
documented tools, avoid printing secrets, and report real runtime evidence
instead of assuming repo state equals active state.

For `claude-mem`, read this first:

```text
docs/runbooks/plugins/claude-mem.md
```

If the workstation is intentionally testing whether the `claude-mem` runbook is
complete, also run:

```text
docs/runbooks/claude-mem-scenario-tests.md
```

## How The Pieces Fit Together

```text
                           Public mirrors
               +------------------------------------+
               | GitHub: pitimon/exp-myCodex        |
               | Gitea : pitimon/exp-myCodex        |
               +------------------+-----------------+
                                  |
                                  v
                 +----------------------------------+
                 | docs / manifests / prompts      |
                 | public-safe Codex handoff layer |
                 +----------------+-----------------+
                                  |
                         target Codex reads
                                  |
                                  v
+--------------------------------------------------------------------+
|                                Codex                               |
|                                                                    |
|  +-----------------------+      +-------------------------------+  |
|  | Plugin management     |      | Runtime verification          |  |
|  | codex plugin ...      |      | cache, MCP, hooks, services   |  |
|  +-----------+-----------+      +---------------+---------------+  |
|              |                                  |                  |
|              v                                  v                  |
|  +-----------------------+      +-------------------------------+  |
|  | 8-Habit AI Dev        |      | claude-mem                    |  |
|  | workflow discipline   |      | hooks, MCP search, worker     |  |
|  +-----------------------+      +---------------+---------------+  |
|                                                   |                |
|  +-----------------------+                       v                |
|  | Claude Governance     |      +-------------------------------+  |
|  | ADRs and governance   |      | SQLite store / queue / search |  |
|  +-----------------------+      | historical agent memory       |  |
|                                 +-------------------------------+  |
|                                                                    |
|  +-----------------------+      +-------------------------------+  |
|  | RTK                   |      | TokenTracker                  |  |
|  | compact command I/O   |      | token and cost visibility     |  |
|  +-----------------------+      +-------------------------------+  |
+--------------------------------------------------------------------+
                                  ^
                                  |
              exact-version overlays and compatibility helpers
```

## Included Workflows

| Workflow | What It Covers | Start Here |
| --- | --- | --- |
| Codex plugin setup | Plugin add, update, reinstall, and version checks | `docs/runbooks/plugins/` |
| `claude-mem` memory | Claude Code-first preflight, Codex hooks, MCP search, worker health, ports `37701`/`37777`, incident mode | `docs/runbooks/plugins/claude-mem.md` |
| `claude-mem` scenario testing | Read-only and state-changing checks for validating the runbook on a real machine | `docs/runbooks/claude-mem-scenario-tests.md` |
| 8-Habit AI Dev | AI-assisted engineering workflow discipline | `docs/runbooks/plugins/8-habit-ai-dev.md` |
| Claude Governance | Governance, ADR, and compliance-oriented skills | `docs/runbooks/plugins/claude-governance.md` |
| TokenTracker | Token and cost visibility, foreground use, and background service setup | `docs/runbooks/tools/tokentracker.md` |
| RTK | Token-optimized shell command output around Codex | `docs/runbooks/tools/rtk.md` |
| Manifests | Public plugin/tool/mirror/version inventory | `docs/manifests/` |
| Overlays | Reviewed local fixes for exact plugin versions | `overlays/` |
| Compatibility helper | Inspect, apply, and verify `claude-mem` Codex compatibility state | `scripts/claude-mem-codex-compat.cjs` |

## Runtime Verification Model

The central lesson from the source workstation is simple: verify active runtime
state before declaring anything healthy.

For Codex plugins, check:

- `codex plugin list`
- `codex mcp list`
- active cache path under `~/.codex/plugins/cache/...`
- marketplace snapshot under `~/.codex/.tmp/marketplaces/...`
- installed plugin version, not just the release or manifest version

For `claude-mem`, check:

- whether Claude Code already has a working `claude-mem` worker
- `~/.claude-mem/worker.pid`
- health on both common ports, `37701` and `37777`
- health `workerPath`, process owner, and current user match
- `mcp-search` availability
- hook output shape, including unsupported `suppressOutput` regressions
- recent context payload behavior with a Codex-shaped `SessionStart` payload

For adjacent tools, check:

- package/version output from the target machine
- service manager state when installed as a background service
- smoke tests from the runbook, not only package installation success

## Version Drift And Overlays

`claude-mem` changes quickly. A healthy worker version and active Codex plugin
version can legitimately differ, especially on shared or test machines. This
repo therefore treats every new active Codex plugin version as a runtime
contract that must be checked before applying patches.

Use the compatibility helper from the repo root:

```bash
node scripts/claude-mem-codex-compat.cjs inspect --json
node scripts/claude-mem-codex-compat.cjs apply --json
node scripts/claude-mem-codex-compat.cjs verify --json
```

Overlay policy:

- apply only `overlays/claude-mem/<active-version>/`
- never apply a patch directory from an older version to a newer cache
- if no overlay exists, report `overlay=missing_for_version:<version>` and keep
  the machine in discovery mode
- update manifests only after public runtime verification

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
    claude-mem-scenario-tests.md
    codex-claude-mem-memory-runbook.md
    plugins/
      8-habit-ai-dev.md
      claude-governance.md
      claude-mem.md
      template.md
    tools/
      rtk.md
      tokentracker.md
overlays/
  claude-mem/13.4.0/
  claude-mem/13.4.1/
scripts/
  claude-mem-codex-compat.cjs
```

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

After public documentation changes, keep both mirrors aligned.

## Public-Safety Rules

- Do not publish API keys, OAuth tokens, bearer tokens, private keys,
  kubeconfigs, passwords, customer context, raw transcripts, or private issue
  links.
- When checking local settings, print only safe derived facts such as boolean
  secret presence and value length.
- Do not run broad secret scans against sensitive local config while memory
  hooks are enabled; narrow the scan to candidate public artifacts.
- Prefer public release URLs, package selectors, and reproducible commands over
  private machine paths.
- Keep Obsidian/private second-brain workflows out of this public repo unless a
  future document is explicitly written as an optional public integration.

## Maintenance Checklist

When updating this repo:

1. Verify current release/runtime state on a real machine.
2. Update the relevant runbook.
3. Update `docs/manifests/*.yaml` when recommended versions change.
4. Add or adjust overlays only for exact plugin versions.
5. Run markdown and whitespace checks.
6. Scan changed public files for secrets or private paths.
7. Push `main` to both public mirrors.

## Contributing

Contributions are welcome when they improve public, reproducible Codex setup
knowledge.

Good contributions:

- add or correct installation and verification steps
- update version manifests after confirming public release state
- improve cross-platform instructions
- add troubleshooting notes backed by observed behavior
- improve scenario tests for real target workstations

Please avoid:

- private URLs or issue links
- secrets, tokens, credentials, kubeconfigs, or raw transcripts
- machine-specific paths unless they are clearly generic examples
- unverified claims about active plugin/runtime behavior

## License

MIT. See `LICENSE`.
