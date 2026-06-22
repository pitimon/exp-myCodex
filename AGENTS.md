# Repository Guidelines

## Project Structure & Module Organization

This repository is a public-safe Codex workstation handoff kit. `README.md` is
the top-level orientation. `docs/README.md` maps the documentation set.
Reusable prompts live in `docs/prompts/`, manifests in `docs/manifests/`, and
plugin/tool runbooks in `docs/runbooks/`. Runtime compatibility overlays live
under `overlays/<plugin>/<version>/`; keep each overlay tied to the exact
verified plugin version. Executable maintenance helpers live in `scripts/`,
currently centered on `scripts/claude-mem-codex-compat.cjs`.

## Build, Test, and Development Commands

There is no application build step. Use validation and formatting checks:

```sh
node scripts/claude-mem-codex-compat.cjs inspect --json
node scripts/claude-mem-codex-compat.cjs verify --json
npx prettier --check "**/*.md"
npx markdownlint-cli2 "**/*.md"
```

Use `apply --json` only when intentionally patching a local `claude-mem`
runtime after confirming the active version. For repository inventory, prefer
`rg --files` and read `docs/manifests/*.yaml` before editing runbooks.

## Coding Style & Naming Conventions

Markdown should be concise, evidence-first, and public-safe. Use fenced command
examples and exact paths. Name runbooks after the plugin or tool they validate,
for example `docs/runbooks/plugins/claude-mem.md`. JavaScript helpers use
CommonJS, `"use strict"`, two-space indentation, semicolons, and descriptive
function names. Keep overlay paths versioned, such as
`overlays/claude-mem/13.8.0/`.

## Testing Guidelines

Treat live runtime evidence as the real test. For `claude-mem` changes, run the
helper `inspect` and `verify` commands, then follow the relevant scenario in
`docs/runbooks/claude-mem-scenario-tests.md`. For documentation-only changes,
run Markdown formatting/lint checks and scan changed files for secrets or
private machine details before publishing.

## Commit & Pull Request Guidelines

Recent history uses short imperative subjects, often with `docs:` for
documentation changes, such as `docs: add Obsidian second-brain workflow`, plus
plain `Add` or `Fix` subjects for overlays and helpers. Pull requests should
state what was verified, list affected docs/manifests/overlays, link relevant
issues, and call out any validation gaps. Do not claim a setup is healthy unless
the active target runtime proves it.

## Security & Configuration Tips

Never commit secrets, tokens, kubeconfigs, raw transcripts, customer context, or
private operational logs. When documenting local settings, publish only safe
derived facts and public release URLs.
