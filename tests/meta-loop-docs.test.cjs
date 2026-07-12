"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("claude-mem reviewed overlay versions exactly match overlay directories", () => {
  const manifest = read("docs/manifests/verified-versions.yaml");
  const match = manifest.match(
    /reviewed_overlay_versions:\n((?:\s+- "[^"]+"\n)+)/,
  );
  assert.ok(match, "reviewed_overlay_versions list is present");
  const listed = [...match[1].matchAll(/- "([^"]+)"/g)]
    .map((entry) => entry[1])
    .sort();
  const overlayRoot = path.join(root, "overlays", "claude-mem");
  const directories = fs
    .readdirSync(overlayRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(listed, directories);
});

test("bootstrap documentation declares the Meta-Loop validate-only boundary", () => {
  const readme = read("README.md");
  const docsReadme = read("docs/README.md");
  const prompt = read("docs/prompts/codex-plugin-validation-prompt.md");
  const tools = read("docs/manifests/codex-tools.yaml");
  const runbook = read("docs/runbooks/tools/meta-loop.md");

  for (const fragment of [
    "Codex Orchestrator",
    "Meta-Loop Control ledger",
    "never launches workers",
    "decision and native spawn outside ledger",
    "recorded after independent spawn/outcome evidence",
    "Meta-Loop Control   | a ledger receipt as spawn proof",
  ])
    assert.match(
      readme,
      new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );

  for (const fragment of [
    "Codex is already installed\nand authenticated.",
    "Reuse or clone a local\nworking copy only at the Phase 1 point",
    "docs/prompts/codex-plugin-validation-prompt.md in full.",
    "Run its Phase 0 pre-flight before changing anything.",
    "Back up existing user configuration before changing it",
    "never print\nsecrets, do not use private repositories",
    "report every skipped or blocked\ncomponent instead of guessing",
    "single canonical\nsource for operational detail, including the read-only Phase 0 then local\nworking-copy sequence",
  ])
    assert.match(
      docsReadme,
      new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );

  for (const fragment of [
    "meta_loop=blocked:<reason>",
    "meta_loop=validated",
    "temporary ledger only",
    "Do not install a hook",
    "attestation is not proof",
    "docs/prompts/meta-loop-validation-prompt.md",
    "A user-requested scope overrides this default baseline.",
    "Decide first whether the requested scope includes multi-agent coordination.",
    "Do not create, test,\n   or remove a temporary directory during Phase 0.",
    "relevant_errata=none",
    "relevant_errata=<issue(s) actually consulted>",
    "do\nnot list issues #5, #6, and #8 as a blanket checklist.",
  ])
    assert.match(
      prompt,
      new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );

  const phase0Start = prompt.indexOf("## Phase 0 — pre-flight (read-only)");
  const phase1Start = prompt.indexOf("## Phase 1 — install and verify");
  const cloneInstruction = prompt.indexOf(
    "reuse or clone one public mirror to a local working copy",
  );
  assert.ok(phase0Start >= 0 && phase1Start > phase0Start);
  assert.ok(
    cloneInstruction > phase1Start,
    "local working-copy creation must occur after read-only Phase 0",
  );
  assert.doesNotMatch(
    prompt.slice(phase0Start, phase1Start),
    /Clone one public mirror to a local working copy/,
  );
  const phase0 = prompt.slice(phase0Start, phase1Start);
  assert.doesNotMatch(
    phase0,
    /\b(?:make|create) a timestamped backup\b/i,
    "Phase 0 may plan backups but must not create them",
  );
  assert.doesNotMatch(
    phase0,
    /\bclone\b/i,
    "Phase 0 must not create a local checkout",
  );
  assert.doesNotMatch(
    phase0,
    /\bmktemp\b/i,
    "Phase 0 must not create temporary storage",
  );
  const phase0WithoutTemporarySafetyProhibition = phase0.replace(
    "Do not create, test,\n   or remove a temporary directory during Phase 0.",
    "",
  );
  assert.doesNotMatch(
    phase0WithoutTemporarySafetyProhibition,
    /\b(?:create|mkdir)\b[^\n]*\btemporary\b/i,
    "Phase 0 must not contain temporary-storage creation instructions",
  );
  assert.match(
    phase0,
    /Plan a timestamped backup for each\n   path\. This plan is record-only: do not write, copy, rename, or otherwise\n   change files during Phase 0\./,
  );
  assert.match(
    prompt.slice(phase1Start),
    /Immediately before any user config, hook, or overlay mutation, create a\n+timestamped backup of each exact path identified in Phase 0/,
  );
  const scopeDecision = prompt.indexOf(
    "Decide first whether the requested scope includes multi-agent coordination.",
  );
  const phase0MetaPrerequisite = prompt.indexOf(
    "For in-scope Meta-Loop Control, verify `node` works",
  );
  assert.ok(
    scopeDecision < phase0MetaPrerequisite,
    "Meta-Loop scope must be decided before prerequisite checks",
  );
  assert.doesNotMatch(
    phase0,
    /mktemp|temporary directory can be created and removed/,
  );
  assert.match(
    prompt,
    /`relevant_errata=none`, or `relevant_errata=<issue\(s\) actually consulted>`/,
  );

  for (const fragment of [
    "default_bootstrap_mode: validate-only",
    "persistent_install: false",
    "native_spawn: false",
    "temporary_ledger: required",
    "temporary_ledger_cleanup: required",
  ])
    assert.match(
      tools,
      new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );

  assert.match(runbook, /## Bootstrap Validation Boundary/);
  assert.match(runbook, /set -e\ntmp_dir="\$\(mktemp -d\)"\ntrap 'rm -rf/);
  assert.match(
    runbook,
    /First decide whether multi-agent coordination is in scope\./,
  );
  assert.match(runbook, /without checking Meta-Loop\nprerequisites\./);
  assert.match(
    runbook,
    /The ledger never\nlaunches, observes, authenticates, or authorizes a worker\./,
  );
});

test("claude-mem evidence contract has a format and explicit state transitions", () => {
  const manifest = read("docs/manifests/verified-versions.yaml");
  for (const fragment of [
    "evidence_record_format:",
    "state (reviewed-exact-match|discovery-no-mutation|supported-with-failure)",
    "state_transitions:",
    "exact_match_failed:",
    "discovery_complete:",
  ])
    assert.match(
      manifest,
      new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
});
