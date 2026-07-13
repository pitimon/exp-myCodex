# Codex Plugin Validation Prompt

Use this prompt on a target workstation. It is the canonical single prompt for
a new-machine bootstrap after the Codex CLI has already been installed and
authenticated.

```text
You are preparing this as a new Codex workstation. Codex is already installed
and authenticated. You are authorized to perform the documented userspace
installation and configuration steps below, but must complete Phase 0 before
changing anything.

## Phase 0 — pre-flight (read-only)

1. Identify OS, architecture, shell, current user, available disk space, and
   whether `git`, `node`, `npm`, `npx`, `codex`, and (when relevant) `claude`
   are available from the shell that will run the tools. Record
   `execution_context=local-shell|ssh|wsl`, the current user, and whether the
   relevant executable paths work in that same context. Run helpers only from
   a local authenticated shell or a verified SSH/WSL shell, never from a
   browser preview or an unverified remote session.
2. Record current `codex --version`, `codex plugin list`, `codex mcp list`, and
   the presence—not values—of existing `~/.codex` and `~/.claude` config/hook
   files. If a local checkout exists, record its origin URL, ref/commit, and
   dirty/clean state; do not trust, modify, or run it in Phase 0.
3. Identify and state the exact path of every user config, hook, or overlay
   that a later Phase 1 action could change. Plan a timestamped backup for each
   path. This plan is record-only: do not write, copy, rename, or otherwise
   change files during Phase 0.
4. If a prerequisite is absent and requires admin privileges, a GUI installer,
   private credentials, or a choice not covered by this repository, do not
   guess or use `sudo`. Mark that component blocked or skipped and continue
   with the safe components.
5. Select one platform section before running installation commands:
   macOS, Linux, Windows PowerShell, or WSL. Use only the matching runbook
   commands and service model. If the execution context and platform section
   do not agree, report `platform=ambiguous` and stop before mutation.
6. Decide first whether the requested scope includes multi-agent coordination.
   If it does not, report `meta_loop=skipped:out-of-scope` and do not inspect
   Meta-Loop prerequisites. If it does, continue with the read-only checks
   below before Phase 1.
7. For in-scope Meta-Loop Control, verify `node` works in this execution
   context and record whether a local working copy and its
   `scripts/meta-loop-control.cjs` are already readable. Do not create, test,
   or remove a temporary directory during Phase 0. If a local copy is absent,
   defer that prerequisite to Phase 1; do not guess a path or create persistent
   state to make this check pass.
8. Decide separately whether final-challenge reviewer routing is in scope. If
   it is not, report `review_routing=skipped:out-of-scope`. If it is, record
   the declared adapter/preflight command plus primary and fallback route names.
   Do not invoke a reviewer, install an adapter, or infer model identity in
   Phase 0; a missing declared adapter is `review_routing=blocked:adapter-missing`.

## Phase 1 — install and verify

Install the documented baseline components supported on this platform, using
the manifests and runbooks below. Prefer the exact commands in this repository
over invented variants, but select the matching macOS, Linux, Windows
PowerShell, or WSL section first. Use the per-component verification before
calling any component healthy.

Immediately before any user config, hook, or overlay mutation, create a
timestamped backup of each exact path identified in Phase 0 and record its
backup location. Never overwrite an unknown configuration without preserving
it first.

Before reading local documentation, running a helper, or validating Meta-Loop
Control, reuse or clone one public mirror to a local working copy when needed.
Do not run helper commands from a browser-only view. This is the first
mutation-capable step and occurs only after Phase 0 pre-flight completes.

For in-scope Meta-Loop Control, after a local copy is available, verify that
`node` and `scripts/meta-loop-control.cjs` work in the selected execution
context. Create a temporary directory only for the validate-only lifecycle and
install cleanup immediately after it is created. If Node, the checkout, script,
or temporary storage is unavailable, report `meta_loop=blocked:<reason>` and
do not invent a fallback.

For in-scope reviewer routing, run only the declared adapter's documented
harmless primary, forced-fallback, and hold canaries after its prerequisites
and action class are approved. Report `review_routing=validated`,
`blocked:<reason>`, or `skipped:out-of-scope`. A receipt is adapter-reported
metadata unless a separately documented trusted attestation mechanism exists.

Start by reading one of these public mirrors:

https://github.com/pitimon/exp-myCodex
https://gitea.ipv9.me/pitimon/exp-myCodex

Then read:

1. docs/README.md
2. docs/manifests/codex-plugins.yaml
3. docs/manifests/codex-tools.yaml
4. docs/manifests/verified-versions.yaml
5. the relevant per-plugin runbook under docs/runbooks/plugins/
6. the relevant per-tool runbook under docs/runbooks/tools/
7. for claude-mem, its compatibility policy in
   docs/manifests/verified-versions.yaml before selecting an overlay or errata.
8. for Meta-Loop Control, docs/prompts/meta-loop-validation-prompt.md and
   docs/runbooks/tools/meta-loop.md before its validate-only check.
9. for in-scope reviewer routing,
   docs/runbooks/tools/meta-loop-review-routing.md and the declared adapter's
   own runbook before any canary.

## Phase 2 — report and handoff

Finish with a concise evidence report: platform and shell, selected platform
section, installed/updated components, active paths and versions, backups made,
checks run, components skipped/blocked with reasons, residual risks, rollback
locations, and whether Codex must be restarted. Never label an unverified
component healthy. If verification fails, stop and propose a rollback that
restores only the timestamped backup created for the changed file. Do not
restore, uninstall packages, delete caches, or restart services automatically;
wait for user approval, then verify the restored configuration and runtime.
For `claude-mem`, include exactly one conditional errata field:
`relevant_errata=none`, or `relevant_errata=<issue(s) actually consulted>`.
List an issue only when its detected version or symptom made it relevant; do
not list issues #5, #6, and #8 as a blanket checklist.
Include every selected component's action class, prerequisite result, mutation
receipt, rollback feasibility, and one of `validated`, `blocked`, `skipped`,
or `not-selected`; never call a component rollback-ready when only a config
backup exists.

Goal:
Bootstrap, update, or validate the requested Codex plugin(s) using the public
runbooks, manifests, and live issue errata.

Default scope:

A user-requested scope overrides this default baseline.

- If the user does not specify plugins, validate the Codex workstation baseline:
  claude-mem, 8-habit-ai-dev, claude-governance, TokenTracker, RTK, and
  Obsidian only where each tool is relevant and available. Also validate the
  CHANGES.log Bridge Pattern when multi-agent handoff is in scope. When
  multi-agent coordination is in scope, validate Meta-Loop Control with a
  temporary ledger only; it is not a persistent installation step.
- For a new machine, clone or otherwise create a local working copy of this
  repository before running helper scripts. Do not run helper commands from a
  browser-only view.
- Treat the default baseline as discovery and validation first. Do not enable a
  persistent service, external data sync, hook installation, or cross-tool
  configuration without explicit component-level approval. TokenTracker is
  metadata/doctor-only by default; dashboard or background mode requires
  `tokentracker_runtime_writes=approved`.
- For claude-mem, use its compatibility policy to choose exactly one state:
  `reviewed-exact-match`, `discovery-no-mutation`, or `supported-with-failure`.
  Record that state before changing a hook or overlay.

Important constraints:

- Do not print API keys, OAuth tokens, bearer tokens, private keys, kubeconfigs,
  passwords, or sensitive local data.
- When checking local settings that may contain secrets, print only secret
  presence and secret length.
- Do not use or reference private repositories.
- Do not call a plugin healthy until its runbook verification passes.
- If a plugin requires a runtime overlay, verify the plugin version, the
  `codex plugin list` path, and the versioned cache path before applying it.
- Do not apply an overlay for a different claude-mem version. If the active
  version has no exact overlay, report discovery mode and use the live errata
  threads only for version-specific workaround guidance.
- Restart Codex after plugin or hook changes.
- On SSH, Linux, WSL, or NVM-based machines, verify `codex`, `node`, and `npx`
  are available in the shell that runs validation. Source `~/.nvm/nvm.sh` or
  use absolute paths when needed.
- If `rg` is unavailable, use `grep` for the same targeted checks or report
  `ripgrep=missing`; do not fail the whole validation only because `rg` is
  absent.
- Before each selected component, use
  `docs/manifests/bootstrap-action-matrix.yaml` to check required versus
  conditional prerequisites, action class, side effects, and rollback
  feasibility. Missing required prerequisites block only that component.

For Meta-Loop Control specifically:

- Use docs/prompts/meta-loop-validation-prompt.md and
  docs/runbooks/tools/meta-loop.md from the local working copy.
- Run only the validate-only lifecycle with a newly created temporary ledger;
  remove that directory after collecting the result. Do not install a hook,
  retain a ledger, or invoke a native worker spawn as part of bootstrap.
- If Phase 0 prerequisites pass and the lifecycle finishes, report
  `meta_loop=validated`. If coordination is outside scope, report
  `meta_loop=skipped:out-of-scope`. If Node, checkout, script, or temporary
  storage is unavailable, report `meta_loop=blocked:<reason>` and do not
  invent a fallback.
- Record the CLI path and `node --version`, lifecycle result, and the two
  boundaries: stale-lock recovery is trusted-local mtime recovery only, and an
  attestation is not proof that the ledger launched, observed, or authenticated
  a native worker.

For claude-mem specifically:

- Start with docs/runbooks/plugins/claude-mem.md.
- Record separately: active Codex plugin version and path, worker version and
  path, the manifest's reviewed baseline, and the selected overlay version or
  `overlay=missing_for_version:<version>`. Do not infer one from another.
- If the active plugin version exactly matches a reviewed overlay, use only that
  overlay and run its complete verification. This is `reviewed-exact-match`.
- If no exact reviewed overlay exists, enter `discovery-no-mutation`: run the
  Version Drift Policy checks, collect evidence, and do not patch or copy an
  older overlay forward. A missing overlay alone is not unhealthy.
- Use issues #5, #6, and #8 only as live errata when the selected state is
  `discovery-no-mutation`, a matching overlay leaves a hook/worker/MCP/lifecycle
  smoke failure, or a target symptom is newer than the runbook baseline.
  Summarize only the comments relevant to the detected version or symptom; do
  not treat historical issue text as an installation recipe.
- If a reviewed exact-match setup still fails verification, record
  `supported-with-failure`, stop mutation, and report the failed evidence plus
  the applicable errata (or `relevant_errata=none`). Do not declare the runtime
  healthy.
- If the goal is to test the runbook itself, also run docs/runbooks/claude-mem-scenario-tests.md and report which scenarios passed, failed, or were skipped.
- Prefer installing and validating claude-mem with Claude Code first, then use the Codex plugin to connect Codex to the already-working worker.
- Before any Codex-side install or overlay, run the runbook's Recommended Claude Code First Preflight and report whether the claude-mem worker is already healthy.
- Check both common claude-mem health ports, 37701 and 37777, but do not accept a healthy HTTP response by itself. Match the health `workerPath`, `~/.claude-mem/worker.pid`, settings port, process owner, and version to the current user.
- Do not assume there is only one active path. Record the `codex plugin list`
  path, the versioned cache under `~/.codex/plugins/cache/`, any staging roots,
  and the worker health `workerPath` as separate facts.
- If `CLAUDE_MEM_CHROMA_ENABLED=true`, verify `uvx` is installed and visible to the worker. Install `uv/uvx` or explicitly report Chroma as skipped/unhealthy before calling vector search healthy.
- Verify `scripts/version-check.js` against the active Codex cache and check for `.install-version` there; do not assume the Claude Code cache marker applies to Codex.
- Prefer `node scripts/claude-mem-codex-compat.cjs inspect|apply|verify --json` from this repo for version-aware overlay handling.
- If applying the local overlay, match the active claude-mem version to the overlay directory.
- If no overlay exists for the active claude-mem version, do not apply an older overlay. Report `overlay=missing_for_version:<version>` and run the runbook's Version Drift Policy discovery checks.
- Inspect both hook layers:
  `~/.codex/hooks.json` and `<active-plugin>/hooks/codex-hooks.json`.
- Treat hook commands that exit 0 with empty stdout as suspicious when Codex
  expects hook JSON.
- If user-level hooks pipe through `scripts/codex-hook-output-filter.js`, verify
  that file exists in the plugin root the hook command resolves at runtime.
- If duplicate `SessionStart` version-check hooks exist, keep a resilient hook
  that returns `{"continue":true}` and report any duplicate plugin-owned hook
  that exits with empty stdout.
- For claude-mem 13.8.0, use the reviewed local overlay under
  `overlays/claude-mem/13.8.0/` when the active plugin version exactly matches.
- For claude-mem 13.8.0, verify `mcp-search` is enabled/running, the worker
  reports healthy on the expected local port, hook smokes return Codex-safe JSON
  without `suppressOutput`, and the context probe returns
  `hookSpecificOutput.additionalContext` without a duplicate top-level
  `systemMessage`.
- For claude-mem 13.8.0, keep `PreToolUse` fail-open/non-blocking for ordinary
  Codex availability, and rely on `PostToolUse` for observation capture.
- For claude-mem 13.4.0, run `node "$PLUGIN/scripts/codex-hook-mode.cjs" balanced` after applying the overlay.
- For legacy claude-mem 13.6.2, keep the Codex marketplace pinned to `v13.6.2` plus the reviewed local overlay unless upgrading to a newer reviewed overlay such as 13.8.0.
- For claude-mem 13.6.2, verify `hooks/codex-hooks.json` has only the top-level `hooks` key; Codex 0.140 rejects a top-level `description` key.
- For claude-mem 13.6.2, apply the minimal overlay to all live-resolvable roots when present: Codex local marketplace snapshot, Codex cache, Codex staging roots, Claude cache, and Claude marketplace.
- For claude-mem 13.6.2, verify hook commands prefer 13.6.2 Codex/local roots before older Claude cache fallbacks, and that worker health reports version 13.6.2.
- For legacy claude-mem 13.4.2, keep the Codex marketplace pinned to `v13.4.2` unless a newer reviewed overlay exists.
- For claude-mem 13.4.2, apply the minimal overlay to all live-resolvable roots when present: Codex cache, Codex marketplace snapshot, Claude cache, and Claude marketplace.
- For claude-mem 13.4.2, verify the Codex `SessionStart`, `PreToolUse`, and `PostToolUse` hook outputs do not contain top-level `suppressOutput`; the overlay includes `scripts/codex-hook-output-filter.js`.
- To validate recent-context injection, run the runbook's Codex-shaped `SessionStart` payload probe. Do not use `{}` as the probe payload.
- Run the Post-Install And Post-Update Verification section before calling healthy.
- If `sqlite3` is missing, report that exact skip and use worker health, logs, MCP search, and observation-write evidence instead of pretending SQL verification passed.
- A warm-up reply of exact `Ready.` is necessary but not sufficient. If Codex human-readable output shows an aggregate `SessionStart Failed`, collect direct hook-script checks and JSON-mode Codex output and report the residual warning.
- Final acceptance requires two `codex exec` lifecycle smokes:
  startup-only and tool-triggering. The tool-triggering smoke must exercise
  `PreToolUse` and `PostToolUse`; do not call claude-mem healthy from a warm-up
  prompt alone.

For TokenTracker specifically:

- Use docs/runbooks/tools/tokentracker.md.
- Verify upstream package metadata from `https://github.com/pitimon/TokenTracker`
  or `npm view @ipv9/tokentracker-cli version bin engines --json` before
  pinning a service.
- Verify `node`, `npm`, and `npx` from the same shell or service environment
  that will run TokenTracker. Node `<20` is unsupported for durable service
  mode even if `--help` still prints with `EBADENGINE` warnings.
- On Linux/SSH with `nvm`, source `~/.nvm/nvm.sh` or use absolute `node`/`npx`
  paths before service validation.
- For background service mode, choose the platform section in the runbook:
  Ubuntu/Linux `systemd --user`, macOS LaunchAgent, Windows PowerShell
  Scheduled Task, or WSL.
- On Linux systemd user services, set both absolute `npx` in `ExecStart=` and
  `Environment=PATH=<node-dir>:/usr/local/bin:/usr/bin:/bin`, especially for
  NVM/Volta/asdf Node installs.
- On Windows PowerShell 5.1, prefer `-DontStopIfGoingOnBatteries`; do not use
  task-setting parameters unless `Get-Command New-ScheduledTaskSettingsSet`
  confirms they exist on that host.
- Report whether the first dashboard run wrote local TokenTracker config or
  notify hooks. Do not call a run read-only if `serve` performed first-time
  setup.
- Verify service-manager state, dashboard HTTP 200, and
  `npx --yes @ipv9/tokentracker-cli@0.39.13 doctor --json`.

For RTK specifically:

- Use docs/runbooks/tools/rtk.md.
- If Homebrew is unavailable, use the official `rtk-ai/rtk` installer with the manifest version, add `~/.local/bin` to `PATH`, and smoke test `rtk --version`, `rtk gain`, and `rtk proxy echo ok`.
- Do not install the global shell hook with `rtk init -g` unless the user explicitly wants automatic shell integration.

For CHANGES.log Bridge specifically:

- Use docs/runbooks/tools/changes-log-bridge.md.
- Verify the Bridge Protocol exists in both `~/.claude/CLAUDE.md` and
  `~/.codex/AGENTS.md` without removing existing instructions.
- Confirm the two Bridge Protocol sections are semantically identical except for
  the expected agent label examples.
- Verify `project_doc_fallback_filenames = ["CLAUDE.md"]` is top-level in
  `~/.codex/config.toml`; if the key reads as `None`, it is probably under the
  wrong TOML table.
- Verify `CHANGES.log` is ignored through the configured global git
  `core.excludesfile` with `git check-ignore -v CHANGES.log`.
- Also run `git status --short --ignored -- CHANGES.log` to prove it is ignored
  and not staged.
- If a `CHANGES.log` exists, inspect only the recent tail and compare the latest
  entry with `git diff --name-only` / `git status --short` so the report catches
  missing or stale handoff notes.
- Check `git config --get core.hooksPath || true` and report any repo-tracked
  hook path separately; the Bridge Protocol does not replace repository hooks.
- Treat `CHANGES.log` as a local scratchpad. Do not include secrets, and do not
  stage it for PRs.

For Obsidian specifically:

- Use docs/runbooks/tools/obsidian.md.
- Treat Obsidian as an optional curated second-brain layer, not proof that claude-mem is healthy.
- Keep raw captures under `Codex/Inbox/` and promote only durable summaries, decisions, lessons, and runbooks into `Claude-Mem/Projects/<project>/`.
- Rebuild and verify the project `Index.md` after adding or updating a project note.
- Do not store raw transcripts, secrets, customer-sensitive data, or private operational logs in Obsidian.

Expected final response:
Provide a concise validation report with:

- plugin marketplace state
- installed plugin version(s)
- active plugin cache path(s), when relevant
- Codex plugin-list path, versioned cache path, staging roots, and user-level hook file status, when relevant
- MCP availability, when relevant
- hook/helper status, when relevant
- exact overlay/workaround used, or `overlay=missing_for_version:<version>`
- claude-mem worker health, port ownership/path, and Chroma/uvx state, when relevant
- TokenTracker package/version, service state, dashboard health, and doctor warnings, when relevant
- RTK version, install path, and smoke-test result, when relevant
- CHANGES.log Bridge protocol parity, Codex fallback status, global ignore
  status, and handoff smoke result, when relevant
- Obsidian vault access, project note path, index rebuild result, and curation boundary, when relevant
- Meta-Loop status (`meta_loop=validated|skipped|blocked`), CLI path and Node
  version, temporary-ledger lifecycle result, and lock/attestation boundaries,
  when multi-agent coordination is in scope
- release URL or verified version used
- validation commands run
- `relevant_errata=none`, or only the issue comments consulted for a matching
  version or symptom and whether a new issue comment should be added
- any remaining risk or manual follow-up
```
