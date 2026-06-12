#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const childProcess = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const home = os.homedir();
const cacheRoot = path.join(home, ".codex", "plugins", "cache", "claude-mem-local", "claude-mem");
const marketplaceRoot = path.join(home, ".codex", ".tmp", "marketplaces", "claude-mem-local", "plugin");
const codexMarketplaceStagingRoot = path.join(home, ".codex", ".tmp", "marketplaces", ".staging");
const claudeCacheRoot = path.join(home, ".claude", "plugins", "cache", "thedotmack", "claude-mem");
const claudeMarketplaceRoot = path.join(home, ".claude", "plugins", "marketplaces", "thedotmack", "plugin");
const requiredHookEvents = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop"];
const suppressPattern = /suppressOutput:!0|suppressOutput:true|"suppressOutput"\s*:\s*true/;

function usage(exitCode = 2) {
  console.error("Usage: node scripts/claude-mem-codex-compat.cjs inspect|apply|verify [--json]");
  process.exit(exitCode);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listDirs(dir) {
  try {
    return fs
      .readdirSync(dir)
      .map((name) => path.join(dir, name))
      .filter((entry) => fs.statSync(entry).isDirectory());
  } catch {
    return [];
  }
}

function isPluginRoot(plugin) {
  return fs.existsSync(path.join(plugin, ".codex-plugin", "plugin.json"));
}

function readPluginManifest(plugin) {
  return readJson(path.join(plugin, ".codex-plugin", "plugin.json"));
}

function normalizePluginRoot(plugin) {
  if (!plugin) return null;
  const trimmed = plugin.trim().replace(/\/+$/, "");
  const nested = path.join(trimmed, "plugin");
  if (isPluginRoot(trimmed)) return trimmed;
  if (isPluginRoot(nested)) return nested;
  return null;
}

function findCodexPluginListPlugin() {
  try {
    const result = childProcess.spawnSync("codex", ["plugin", "list"], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 4,
    });
    if (result.status !== 0) return null;
    for (const line of result.stdout.split(/\r?\n/)) {
      if (!line.includes("claude-mem@claude-mem-local")) continue;
      const plugin = normalizePluginRoot(line.trim().split(/\s+/).at(-1));
      if (!plugin) continue;
      try {
        const manifest = readPluginManifest(plugin);
        if (manifest.name === "claude-mem") return plugin;
      } catch {
        return plugin;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function findVersionedCodexCache(version) {
  const candidate = path.join(cacheRoot, version);
  return fs.existsSync(candidate) ? candidate : null;
}

function findLatestCodexCache() {
  const dirs = listDirs(cacheRoot).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  const plugin = dirs.find(isPluginRoot);
  if (!plugin) {
    throw new Error(`active claude-mem Codex cache not found under ${cacheRoot}`);
  }
  return plugin;
}

function findActivePlugin() {
  return findCodexPluginListPlugin() || findLatestCodexCache();
}

function readPluginVersion(plugin) {
  return readPluginManifest(plugin).version;
}

function findVersionedClaudeCache(version) {
  const candidate = path.join(claudeCacheRoot, version);
  return fs.existsSync(candidate) ? candidate : null;
}

function collectCodexStagingPlugins(version) {
  return listDirs(codexMarketplaceStagingRoot)
    .map((dir) => path.join(dir, "plugin"))
    .filter((plugin) => {
      const manifest = path.join(plugin, ".codex-plugin", "plugin.json");
      if (!fs.existsSync(manifest)) return false;
      try {
        const parsed = readJson(manifest);
        return parsed.name === "claude-mem" && parsed.version === version;
      } catch {
        return false;
      }
    });
}

function uniqTargets(targets) {
  const seen = new Set();
  return targets.filter((target) => {
    if (!target.path || !fs.existsSync(target.path)) return false;
    const resolved = fs.realpathSync(target.path);
    if (seen.has(resolved)) return false;
    seen.add(resolved);
    return true;
  });
}

function collectTargetRoots(activePlugin, version) {
  return uniqTargets([
    { kind: "codex-active", path: activePlugin },
    { kind: "codex-cache", path: findVersionedCodexCache(version) },
    { kind: "codex-marketplace", path: marketplaceRoot },
    ...collectCodexStagingPlugins(version).map((plugin, index) => ({
      kind: `codex-staging-${index + 1}`,
      path: plugin,
    })),
    { kind: "claude-cache", path: findVersionedClaudeCache(version) },
    { kind: "claude-marketplace", path: claudeMarketplaceRoot },
  ]);
}

function walk(dir, prefix = "") {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = path.join(prefix, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) out.push(...walk(abs, rel));
    else out.push(rel);
  }
  return out;
}

function sha256(file) {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function parseSkillDescriptions(plugin) {
  const skillsDir = path.join(plugin, "skills");
  const issues = [];
  const descriptions = [];
  if (!fs.existsSync(skillsDir)) return { descriptions, issues };

  for (const skill of walk(skillsDir).filter((rel) => rel.endsWith("SKILL.md"))) {
    const file = path.join(skillsDir, skill);
    const text = fs.readFileSync(file, "utf8");
    const match = text.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) continue;

    const frontmatter = match[1];
    const oneLine = frontmatter.match(/^description:\s*(.+)$/m);
    const block = frontmatter.match(/^description:\s*\|\s*\n((?:[ \t]+.*\n?)*)/m);
    const value = block
      ? block[1]
          .split(/\r?\n/)
          .map((line) => line.replace(/^[ \t]+/, ""))
          .join("\n")
          .trim()
      : oneLine
        ? oneLine[1].trim()
        : "";
    if (!value) continue;

    const item = { file: path.relative(plugin, file), chars: value.length };
    descriptions.push(item);
    if (value.length > 1024) issues.push({ ...item, max: 1024 });
  }
  return { descriptions, issues };
}

function inspect() {
  const plugin = findActivePlugin();
  const version = readPluginVersion(plugin);
  const overlay = path.join(repoRoot, "overlays", "claude-mem", version);
  const hookFiles = ["hooks/codex-hooks.json", "hooks/hooks.json"];
  const hookState = {};
  const targetRoots = collectTargetRoots(plugin, version);

  for (const rel of hookFiles) {
    const file = path.join(plugin, rel);
    if (!fs.existsSync(file)) {
      hookState[rel] = { exists: false };
      continue;
    }
    const text = fs.readFileSync(file, "utf8");
    const parsed = readJson(file);
    hookState[rel] = {
      exists: true,
      sha256: sha256(file),
      events: Object.keys(parsed.hooks || {}),
      hasRequiredEvents: requiredHookEvents.every((event) => Boolean(parsed.hooks?.[event])),
      hasUnsupportedSuppressOutput: suppressPattern.test(text),
    };
  }

  const filter = path.join(plugin, "scripts", "codex-hook-output-filter.js");
  const installMarker = path.join(plugin, ".install-version");
  const skillScan = parseSkillDescriptions(plugin);

  return {
    activePlugin: plugin,
    version,
    overlay,
    overlayExists: fs.existsSync(overlay),
    marketplaceSnapshot: marketplaceRoot,
    marketplaceSnapshotExists: fs.existsSync(marketplaceRoot),
    targetRoots,
    installMarkerExists: fs.existsSync(installMarker),
    hookState,
    filterExists: fs.existsSync(filter),
    skillDescriptionIssues: skillScan.issues,
    skillDescriptions: skillScan.descriptions,
  };
}

function backupExisting(target, rel, stamp) {
  const file = path.join(target, rel);
  if (!fs.existsSync(file)) return;
  const backup = `${file}.bak-compat-${stamp}`;
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.copyFileSync(file, backup);
}

function applyOverlay() {
  const state = inspect();
  if (!state.overlayExists) {
    const err = new Error(`overlay=missing_for_version:${state.version}`);
    err.code = 2;
    throw err;
  }

  const files = walk(state.overlay);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  for (const target of state.targetRoots) {
    for (const rel of files) backupExisting(target.path, rel, stamp);
    fs.cpSync(state.overlay, target.path, { recursive: true });
  }
  return { ...state, appliedFiles: files };
}

function verify() {
  const state = inspect();
  const errors = [];
  if (!state.installMarkerExists) errors.push("missing .install-version in active Codex cache");
  for (const target of state.targetRoots) {
    for (const rel of ["hooks/codex-hooks.json", "hooks/hooks.json"]) {
      const file = path.join(target.path, rel);
      if (!fs.existsSync(file)) {
        errors.push(`${target.kind}:${rel} missing`);
        continue;
      }
      const text = fs.readFileSync(file, "utf8");
      const parsed = readJson(file);
      const events = Object.keys(parsed.hooks || {});
      if (rel === "hooks/codex-hooks.json" && !requiredHookEvents.every((event) => Boolean(parsed.hooks?.[event]))) {
        errors.push(`${target.kind}:${rel} missing required hook events`);
      }
      if (suppressPattern.test(text)) errors.push(`${target.kind}:${rel} contains unsupported suppressOutput`);
      if (rel === "hooks/codex-hooks.json" && !events.includes("PreToolUse")) {
        errors.push(`${target.kind}:${rel} missing PreToolUse`);
      }
    }
    if (!fs.existsSync(path.join(target.path, "scripts", "codex-hook-output-filter.js"))) {
      errors.push(`${target.kind}:scripts/codex-hook-output-filter.js missing`);
    }
  }
  for (const issue of state.skillDescriptionIssues) {
    errors.push(`${issue.file} description exceeds ${issue.max} chars (${issue.chars})`);
  }
  const hookSmokes = [];
  function assertNoSuppressOutput(stdout, label) {
    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length !== 1) {
      errors.push(`${label} emitted ${lines.length} JSON lines`);
      return null;
    }
    try {
      const parsed = JSON.parse(lines[0]);
      if (parsed.suppressOutput) errors.push(`${label} emitted suppressOutput`);
      if (parsed.continue !== true) errors.push(`${label} did not return continue=true`);
      return parsed;
    } catch {
      errors.push(`${label} emitted invalid JSON`);
      return null;
    }
  }

  if (state.filterExists) {
    const filter = path.join(state.activePlugin, "scripts", "codex-hook-output-filter.js");
    const child = childProcess.spawnSync(process.execPath, [filter, "--event", "PostToolUse"], {
      input: "{\"continue\":true,\"suppressOutput\":true}\n",
      encoding: "utf8",
    });
    if (child.status !== 0) errors.push("codex-hook-output-filter.js exited non-zero");
    else {
      const parsed = assertNoSuppressOutput(child.stdout, "codex-hook-output-filter.js");
      if (parsed) hookSmokes.push({ event: "filter", ok: true, keys: Object.keys(parsed) });
    }
  }

  const runner = path.join(state.activePlugin, "scripts", "bun-runner.js");
  const worker = path.join(state.activePlugin, "scripts", "worker-service.cjs");
  const filter = path.join(state.activePlugin, "scripts", "codex-hook-output-filter.js");
  if (fs.existsSync(runner) && fs.existsSync(worker) && fs.existsSync(filter)) {
    const smokePayloads = [
      {
        event: "file-context",
        payload: {
          session_id: "codex-compat-verify",
          hook_event_name: "PreToolUse",
          cwd: repoRoot,
          tool_name: "Read",
          tool_input: { file_path: path.join(repoRoot, "README.md") },
          transcript_path: "/tmp/codex-compat-verify.jsonl",
        },
      },
      {
        event: "observation",
        payload: {
          session_id: "codex-compat-verify",
          hook_event_name: "PostToolUse",
          cwd: repoRoot,
          tool_name: "Read",
          tool_input: { file_path: path.join(repoRoot, "README.md") },
          tool_response: { output: "compat verification probe" },
          transcript_path: "/tmp/codex-compat-verify.jsonl",
        },
      },
    ];
    for (const smoke of smokePayloads) {
      const child = childProcess.spawnSync(
        process.execPath,
        [runner, worker, "hook", "codex", smoke.event],
        {
          input: `${JSON.stringify(smoke.payload)}\n`,
          encoding: "utf8",
          env: { ...process.env, CLAUDE_PLUGIN_ROOT: state.activePlugin },
        },
      );
      if (child.status !== 0) {
        errors.push(`hook ${smoke.event} exited non-zero`);
        continue;
      }
      const filtered = childProcess.spawnSync(process.execPath, [filter, "--event", smoke.event], {
        input: child.stdout,
        encoding: "utf8",
      });
      if (filtered.status !== 0) {
        errors.push(`hook ${smoke.event} filter exited non-zero`);
        continue;
      }
      const parsed = assertNoSuppressOutput(filtered.stdout, `hook ${smoke.event}`);
      if (parsed) hookSmokes.push({ event: smoke.event, ok: true, keys: Object.keys(parsed) });
    }
  }

  return { ...state, ok: errors.length === 0, errors, hookSmokes };
}

function print(value, asJson) {
  if (asJson) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (Array.isArray(item) || (item && typeof item === "object")) {
      console.log(`${key}=${JSON.stringify(item)}`);
    } else {
      console.log(`${key}=${item}`);
    }
  }
}

const command = process.argv[2];
const asJson = process.argv.includes("--json");
if (!command) usage();

try {
  if (command === "inspect") print(inspect(), asJson);
  else if (command === "apply") print(applyOverlay(), asJson);
  else if (command === "verify") {
    const result = verify();
    print(result, asJson);
    if (!result.ok) process.exit(1);
  } else usage();
} catch (error) {
  console.error(error.message);
  process.exit(error.code || 1);
}
