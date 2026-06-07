# Claude Governance for Codex

## Purpose

Install or update the `claude-governance` plugin for Codex. This plugin
provides governance-oriented skills such as ADR creation, governance checks,
spec-driven development, and compliance checklists.

## Install

```bash
codex plugin marketplace add pitimon/claude-governance
codex plugin add claude-governance@pitimon-claude-governance
```

## Update

Use remove/add after marketplace upgrade so the installed cache refreshes even
when a stale local cache exists.

```bash
codex plugin marketplace upgrade pitimon-claude-governance
codex plugin remove claude-governance@pitimon-claude-governance || true
codex plugin add claude-governance@pitimon-claude-governance
```

## Verify

```bash
codex plugin list
```

Expected:

```text
claude-governance@pitimon-claude-governance installed, enabled
```

Start a fresh Codex session and confirm governance skills are available.

## Release

```text
https://github.com/pitimon/claude-governance/releases/tag/v3.4.0
```

## Troubleshooting

If `codex plugin list` still shows an older version after update:

```bash
codex plugin marketplace upgrade pitimon-claude-governance
codex plugin remove claude-governance@pitimon-claude-governance || true
codex plugin add claude-governance@pitimon-claude-governance
```

Then fully restart Codex. Plugin files are loaded at session start.
