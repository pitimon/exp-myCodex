# CHANGES.log Bridge Pattern Runbook

Date: 2026-06-22
Status: Public local-workstation handoff runbook
Pattern credit: Dheeraj Sharma & Wyndo, The AI Maker

## Purpose

Use the CHANGES.log Bridge Pattern when Claude Code and Codex may work in the
same git repository on the same workstation. The bridge gives both agents one
local scratchpad for handoff state, while keeping that scratchpad out of pull
requests.

The pattern has four layers:

```text
userspace instructions:
  ~/.claude/CLAUDE.md
  ~/.codex/AGENTS.md

Codex project fallback:
  ~/.codex/config.toml
  project_doc_fallback_filenames = ["CLAUDE.md"]

repo scratchpad:
  <repo>/CHANGES.log

global git ignore:
  core.excludesfile contains CHANGES.log
```

Do not store secrets, tokens, customer data, raw logs, or private incident
details in `CHANGES.log`.

## Bridge Protocol Text

Add this section verbatim to both global instruction files. Place it before any
final include such as `@RTK.md` if that file uses include directives.

<!-- markdownlint-disable MD013 -->

```markdown
## Multi-Agent Handoff — CHANGES.log Bridge

When working in a project (git repo) where multiple AI agents (Claude Code + Codex)
may take turns:

- **Before starting work**: read `./CHANGES.log` (if present) to see which files the
  previous agent touched and what the next step is — do NOT overwrite recent work.
- **When finishing (before ending a turn that modified files)**: append one entry to
  the end of `./CHANGES.log` (newest at the bottom) in this format:
  - `## [YYYY-MM-DD HH:MM] <agent>` — `<agent>` is `CC` (Claude Code) or `Codex`
  - **Changed**: files modified + one-line summary
  - **Next**: next step / what is still pending
- If `./CHANGES.log` does not exist yet, create it on the first file change in that project.
- `CHANGES.log` is an internal scratchpad — it is local, git-ignored, and MUST NOT contain secrets.
```

<!-- markdownlint-enable MD013 -->

## Install Steps

1. Back up userspace files before editing.

   ```bash
   TS=$(date +%Y%m%d%H%M%S)
   C="$HOME/.claude/CLAUDE.md"
   A="$HOME/.codex/AGENTS.md"
   T="$HOME/.codex/config.toml"
   cp "$C" "$C.bak.$TS" 2>/dev/null || true
   cp "$A" "$A.bak.$TS" 2>/dev/null || true
   cp "$T" "$T.bak.$TS" 2>/dev/null || true
   ```

2. Add the Bridge Protocol to `~/.claude/CLAUDE.md`.

   Append or insert the section without deleting existing instructions. Keep the
   text agent-neutral so Claude Code and Codex follow the same rules.

3. Add the same Bridge Protocol to `~/.codex/AGENTS.md`.

   Use the same text. The agent identity is chosen at write time by the agent
   appending the `CHANGES.log` entry: `CC` or `Codex`.

4. Add the Codex project-doc fallback at top level in `~/.codex/config.toml`.

   The key must appear before any TOML table header such as `[projects]`.
   Placing it under a table can silently make Codex miss the setting.

   ```toml
   project_doc_fallback_filenames = ["CLAUDE.md"]
   ```

   This lets Codex read a repo-local `CLAUDE.md` when a directory does not have
   its own `AGENTS.md`. If a project ships an `AGENTS.md`, Codex uses that file
   and skips the fallback at that directory level.

5. Add `CHANGES.log` to the global git excludes file.

   Respect an existing `core.excludesfile`; do not assume the target file is
   `~/.gitignore_global`.

   ```bash
   EX=$(git config --global core.excludesfile || true)
   if [ -z "$EX" ]; then
     git config --global core.excludesfile "$HOME/.gitignore_global"
     EX="$HOME/.gitignore_global"
   fi

   mkdir -p "$(dirname "$EX")"
   touch "$EX"
   grep -qxF 'CHANGES.log' "$EX" || printf '\nCHANGES.log\n' >> "$EX"
   ```

## Verification

1. Confirm Codex config parses and the fallback is top-level.

   ```bash
   python3 - <<'PY'
   import pathlib, tomllib
   path = pathlib.Path.home() / ".codex" / "config.toml"
   data = tomllib.load(path.open("rb"))
   print("parse=OK")
   print(data.get("project_doc_fallback_filenames"))
   PY
   ```

   Expected:

   ```text
   parse=OK
   ['CLAUDE.md']
   ```

2. Confirm `CHANGES.log` is globally ignored.

   Run this inside any git repository:

   ```bash
   touch CHANGES.log
   git check-ignore CHANGES.log
   rm -f CHANGES.log
   ```

   Expected output includes:

   ```text
   CHANGES.log
   ```

3. Confirm the bridge is local-only and visible in repo status checks.

   Run this inside the target repo:

   ```bash
   git status --short --ignored -- CHANGES.log
   git check-ignore -v CHANGES.log
   tail -40 CHANGES.log 2>/dev/null || true
   ```

   Expected:

   - `git check-ignore -v` identifies the exact ignore rule source.
   - `CHANGES.log` is not shown as a normal tracked or untracked file.
   - The latest `CHANGES.log` entry reflects the current dirty worktree when
     files have been modified.

4. Confirm Codex reads repo-local `CLAUDE.md` through fallback.

   In a test repo that has `CLAUDE.md` and no `AGENTS.md`, write a harmless
   project-specific rule in `CLAUDE.md`, start Codex in that repo, and ask what
   the rule says. Codex should answer from the repo-local instruction.

5. Run the handoff smoke.

   Use a test repo and make a small file change with Claude Code. Confirm a
   `CHANGES.log` entry appears with `CC`. Then open Codex in the same repo and
   ask it to read `CHANGES.log` and state the next step. After Codex makes a
   small change, confirm it appends a new `Codex` entry below the `CC` entry
   without overwriting it.

## Operational Checks

Use these checks when deciding whether the bridge is actually current for a
repo, not merely installed on the workstation.

```bash
git status --short --ignored -- CHANGES.log
git diff --name-only
tail -40 CHANGES.log 2>/dev/null || true
git check-ignore -v CHANGES.log
```

Compare the latest `CHANGES.log` entry against the actual changed files. A
bridge can be installed correctly but still be incomplete if the current dirty
worktree has files that are not mentioned in the latest handoff entry.

If the pass is verification-only and no files were changed, do not append a
noise entry to `CHANGES.log`.

## Hook Enforcement Caveat

This bridge is instruction-driven by default. Do not assume a repo-tracked hook
or `.githooks/` directory is enforcing it unless Git is configured to use that
hook path.

Check:

```bash
git config --get core.hooksPath || true
ls -la .git/hooks 2>/dev/null || true
ls -la .githooks 2>/dev/null || true
```

If `core.hooksPath` is empty, Git uses `.git/hooks`, not a tracked `.githooks/`
directory. Treat hook-based enforcement as an optional future hardening layer,
separate from the global instruction and ignore setup.

## Definition Of Done

- [ ] Bridge Protocol exists in both `~/.claude/CLAUDE.md` and
      `~/.codex/AGENTS.md`.
- [ ] The protocol text is materially identical in both files.
- [ ] `project_doc_fallback_filenames = ["CLAUDE.md"]` is top-level in
      `~/.codex/config.toml`, TOML parsing passes, and the key returns
      `["CLAUDE.md"]`.
- [ ] `CHANGES.log` is ignored through the configured global git excludes file.
- [ ] `git check-ignore -v CHANGES.log` identifies the ignore rule source.
- [ ] The latest `CHANGES.log` entry matches the current dirty worktree when
      files have been modified.
- [ ] End-to-end smoke passes: `CC` writes, Codex reads, Codex appends, and
      neither agent overwrites the prior entry.

## Troubleshooting

- If Codex cannot see repo-local `CLAUDE.md`, check whether an `AGENTS.md`
  exists in the same directory. `AGENTS.md` takes precedence over fallback.
- If the fallback key returns `None`, it was probably inserted under a TOML
  table. Move it above the first `[table]` header.
- If `git check-ignore CHANGES.log` prints nothing, inspect
  `git config --global core.excludesfile` and add `CHANGES.log` to that exact
  file.
- If `CHANGES.log` appears in a PR, remove it from the index and keep it local:

  ```bash
  git rm --cached CHANGES.log
  git check-ignore CHANGES.log
  ```

- If a tracked `.githooks/` file looks like enforcement but nothing runs, check
  `git config --get core.hooksPath`. The active hook path may still be
  `.git/hooks`.
- If the bridge appears healthy but another agent misses the current state,
  compare `tail -40 CHANGES.log` against `git diff --name-only`; the latest
  handoff may be stale.
