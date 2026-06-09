#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const home = os.homedir();
const cacheRoot = path.join(home, ".codex", "plugins", "cache", "claude-mem-local", "claude-mem");
const marketplaceRoot = path.join(home, ".codex", ".tmp", "marketplaces", "claude-mem-local", "plugin");
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

function findActivePlugin() {
  const dirs = listDirs(cacheRoot).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  const plugin = dirs.find((dir) => fs.existsSync(path.join(dir, ".codex-plugin", "plugin.json")));
  if (!plugin) {
    throw new Error(`active claude-mem Codex cache not found under ${cacheRoot}`);
  }
  return plugin;
}

function readPluginVersion(plugin) {
  return readJson(path.join(plugin, ".codex-plugin", "plugin.json")).version;
}

function findVersionedClaudeCache(version) {
  const candidate = path.join(claudeCacheRoot, version);
  return fs.existsSync(candidate) ? candidate : null;
}

function collectTargetRoots(activePlugin, version) {
  return [
    { kind: "codex-cache", path: activePlugin },
    { kind: "codex-marketplace", path: marketplaceRoot },
    { kind: "claude-cache", path: findVersionedClaudeCache(version) },
    { kind: "claude-marketplace", path: claudeMarketplaceRoot },
  ].filter((target) => target.path && fs.existsSync(target.path));
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
  }
  for (const issue of state.skillDescriptionIssues) {
    errors.push(`${issue.file} description exceeds ${issue.max} chars (${issue.chars})`);
  }
  if (state.filterExists) {
    const filter = path.join(state.activePlugin, "scripts", "codex-hook-output-filter.js");
    const child = require("child_process").spawnSync(process.execPath, [filter, "--event", "PostToolUse"], {
      input: "{\"continue\":true,\"suppressOutput\":true}\n",
      encoding: "utf8",
    });
    if (child.status !== 0) errors.push("codex-hook-output-filter.js exited non-zero");
    else {
      try {
        const parsed = JSON.parse(child.stdout.trim());
        if (parsed.suppressOutput || parsed.continue !== true) errors.push("codex-hook-output-filter.js did not remove suppressOutput");
      } catch {
        errors.push("codex-hook-output-filter.js emitted invalid JSON");
      }
    }
  }
  return { ...state, ok: errors.length === 0, errors };
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
