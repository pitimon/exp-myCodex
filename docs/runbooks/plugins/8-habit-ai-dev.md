# 8-Habit AI Dev for Codex

## Purpose

Install or update the `8-habit-ai-dev` plugin for Codex. This plugin provides
AI-assisted development workflow skills such as requirements, review,
cross-verification, deployment guidance, and related operating discipline.

## Install

```bash
codex plugin marketplace add pitimon/8-habit-ai-dev
codex plugin add 8-habit-ai-dev@pitimon-8-habit-ai-dev
```

## Update

Use remove/add after marketplace upgrade so the installed cache refreshes even
when a stale local cache exists.

```bash
codex plugin marketplace upgrade pitimon-8-habit-ai-dev
codex plugin remove 8-habit-ai-dev@pitimon-8-habit-ai-dev || true
codex plugin add 8-habit-ai-dev@pitimon-8-habit-ai-dev
```

## Verify

```bash
codex plugin list
```

Expected:

```text
8-habit-ai-dev@pitimon-8-habit-ai-dev installed, enabled
```

Start a fresh Codex session and confirm the startup context lists the active
8-Habit AI Dev plugin/version and available skills.

## Troubleshooting

If `codex plugin list` still shows an older version after update:

```bash
codex plugin marketplace upgrade pitimon-8-habit-ai-dev
codex plugin remove 8-habit-ai-dev@pitimon-8-habit-ai-dev || true
codex plugin add 8-habit-ai-dev@pitimon-8-habit-ai-dev
```

Then fully restart Codex. Plugin files are loaded at session start.
