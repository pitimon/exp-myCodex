# claude-mem 13.8.0 Codex Local Patch Overlay

This directory contains the minimal reviewed patch overlay for the Codex `claude-mem` 13.8.0 runtime.

Apply it only to `claude-mem` version `13.8.0`. It contains only:

```text
.install-version
hooks/codex-hooks.json
scripts/codex-hook-output-filter.js
```

The patch keeps Codex hook output inside the supported JSON contract, strips duplicate `systemMessage` from context hooks when `hookSpecificOutput.additionalContext` is present, and makes hook root resolution prefer the active Codex/local 13.8.0 roots before Claude fallback roots.

Final acceptance is a fresh Codex lifecycle smoke that exercises startup, prompt, tool, and stop hook paths with no parse warning, MCP startup interruption, or `Failed` hook line.

Do not put API keys or machine-local secrets in this directory.
