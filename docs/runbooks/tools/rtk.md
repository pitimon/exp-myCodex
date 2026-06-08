# RTK Runbook

Date: 2026-06-08
Status: Public optional efficiency-tool runbook

## Purpose

RTK, Rust Token Killer, is a command-line proxy that filters and summarizes
shell command output before it reaches an LLM context.

Use it around Codex when a command may produce noisy output, especially:

- `git diff`, `git status`, `git log`
- test runners
- package manager output
- `rg`, `grep`, `find`, `ls`, and tree output
- cloud, Kubernetes, Docker, database, and log commands

RTK is optional. It does not replace careful verification. It helps keep long
Codex sessions smaller and easier to review.

## Verified Local State

Verified on 2026-06-08:

```text
rtk version: 0.42.3
install path: /opt/homebrew/bin/rtk
install source: Homebrew formula rtk
Linux install source: official rtk-ai/rtk release installer
homepage: https://www.rtk-ai.app/
license: Apache-2.0
```

Local `rtk gain` showed material savings on this workstation:

```text
tokens saved: 20.5M
savings rate: 63.4%
```

Treat those numbers as local evidence, not a universal guarantee.

## Install

macOS with Homebrew:

```bash
brew install rtk
rtk --version
```

Linux or WSL with the official release installer:

```bash
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh -o /tmp/rtk-install.sh
less /tmp/rtk-install.sh
RTK_VERSION=v0.42.3 sh /tmp/rtk-install.sh

export PATH="$HOME/.local/bin:$PATH"
rtk --version
```

If `rtk` is installed into `~/.local/bin`, add that directory to the user's
shell startup file before using it in future Codex sessions.

If another platform package is used, verify it independently:

```bash
which rtk
rtk --version
rtk --help
```

## Basic Use

Prefix noisy shell commands with `rtk`:

```bash
rtk git status
rtk git diff
rtk npm test
rtk pytest -q
rtk cargo test
rtk rg "pattern" .
```

Run a command without filtering but still track usage:

```bash
rtk proxy <command>
```

Run a raw shell command:

```bash
rtk run 'printf "hello\n"'
```

Measure savings:

```bash
rtk gain
rtk gain --history
```

## Codex Usage Pattern

For Codex work, prefer RTK on commands that commonly flood context:

```bash
rtk git diff --cached
rtk npm run build
rtk npm test
rtk docker ps
rtk kubectl --context <context> get pods -n <namespace>
rtk journalctl -u <service> -n 200 --no-pager
```

Use normal commands when exact raw output matters, for example when copying a
small error message, validating a checksum, or inspecting a short file.

## Verification

Run:

```bash
rtk --version
rtk gain
rtk proxy echo ok
```

Expected:

- `rtk --version` prints a version.
- `rtk gain` prints savings analytics.
- `rtk proxy echo ok` prints `ok`.
- `rtk gain` may warn that no shell hook is installed. That is acceptable for
  manual `rtk ...` and `rtk proxy ...` use. Run `rtk init -g` only if the user
  intentionally wants global automatic shell integration.

## Guardrails

- RTK filters output; do not use filtered output as the only source when exact
  bytes, full logs, or full JSON are required.
- Do not rely on RTK to hide secrets. Avoid running commands that print secrets
  in the first place.
- For production or infrastructure work, keep normal safety rules: explicit
  contexts, dry-runs before writes, and clear rollback plans.
- If Codex needs to quote exact evidence, rerun a narrow raw command or use
  `rtk proxy`.
