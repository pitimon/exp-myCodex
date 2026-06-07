# Plugin Name for Codex

## Purpose

Describe what this plugin adds to Codex and when an operator should install it.

## Install

```bash
codex plugin marketplace add <owner>/<repo>
codex plugin add <plugin>@<marketplace>
```

## Update

```bash
codex plugin marketplace upgrade <marketplace>
codex plugin remove <plugin>@<marketplace> || true
codex plugin add <plugin>@<marketplace>
```

## Verify

```bash
codex plugin list
codex mcp list
```

Expected:

```text
<plugin>@<marketplace> installed, enabled
```

## Release

Add the public release URL when available.

## Notes

- Do not include private URLs or machine-specific paths.
- Do not include secrets.
