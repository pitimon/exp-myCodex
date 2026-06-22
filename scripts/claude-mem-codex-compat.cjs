#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const childProcess = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const home = os.homedir();
const cacheRoot = path.join(
  home,
  ".codex",
  "plugins",
  "cache",
  "claude-mem-local",
  "claude-mem",
);
const localMarketplaceRoot = path.join(
  home,
  ".codex",
  "local-marketplaces",
  "claude-mem-local",
  "plugin",
);
const marketplaceRoot = path.join(
  home,
  ".codex",
  ".tmp",
  "marketplaces",
  "claude-mem-local",
  "plugin",
);
const codexMarketplaceStagingRoot = path.join(
  home,
  ".codex",
  ".tmp",
  "marketplaces",
  ".staging",
);
const claudeCacheRoot = path.join(
  home,
  ".claude",
  "plugins",
  "cache",
  "thedotmack",
  "claude-mem",
);
const claudeMarketplaceRoot = path.join(
  home,
  ".claude",
  "plugins",
  "marketplaces",
  "thedotmack",
  "plugin",
);
const codexUserHooksFile = path.join(home, ".codex", "hooks.json");
const requiredHookEvents = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "Stop",
];
const suppressPattern =
  /suppressOutput:!0|suppressOutput:true|"suppressOutput"\s*:\s*true/;
const allowedCodexHookTopLevelKeys = new Set(["hooks"]);

function usage(exitCode = 2) {
  console.error(
    "Usage: node scripts/claude-mem-codex-compat.cjs inspect|apply|verify [--json]",
  );
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
  const dirs = listDirs(cacheRoot).sort(
    (a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs,
  );
  const plugin = dirs.find(isPluginRoot);
  if (!plugin) {
    throw new Error(
      `active claude-mem Codex cache not found under ${cacheRoot}`,
    );
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
    { kind: "codex-local-marketplace", path: localMarketplaceRoot },
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
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function parseSkillDescriptions(plugin) {
  const skillsDir = path.join(plugin, "skills");
  const issues = [];
  const descriptions = [];
  if (!fs.existsSync(skillsDir)) return { descriptions, issues };

  for (const skill of walk(skillsDir).filter((rel) =>
    rel.endsWith("SKILL.md"),
  )) {
    const file = path.join(skillsDir, skill);
    const text = fs.readFileSync(file, "utf8");
    const match = text.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) continue;

    const frontmatter = match[1];
    const oneLine = frontmatter.match(/^description:\s*(.+)$/m);
    const block = frontmatter.match(
      /^description:\s*\|\s*\n((?:[ \t]+.*\n?)*)/m,
    );
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

function collectHookCommands(parsed) {
  const out = [];
  for (const [event, groups] of Object.entries(parsed.hooks || {})) {
    if (!Array.isArray(groups)) continue;
    groups.forEach((group, groupIndex) => {
      const hooks = Array.isArray(group.hooks) ? group.hooks : [];
      hooks.forEach((hook, hookIndex) => {
        if (hook?.type !== "command" || typeof hook.command !== "string")
          return;
        out.push({
          event,
          groupIndex,
          hookIndex,
          timeout: hook.timeout ?? null,
          command: hook.command,
          usesFilter: hook.command.includes("codex-hook-output-filter.js"),
          usesVersionCheck: hook.command.includes("version-check.js"),
          printsContinue:
            hook.command.includes('{"continue":true}') ||
            hook.command.includes('{"continue":true}'),
        });
      });
    });
  }
  return out;
}

function inspectHookFile(file) {
  if (!fs.existsSync(file)) return { exists: false };
  const text = fs.readFileSync(file, "utf8");
  const parsed = readJson(file);
  const commands = collectHookCommands(parsed);
  const topLevelKeys = Object.keys(parsed);
  const unsupportedTopLevelKeys = topLevelKeys.filter(
    (key) => !allowedCodexHookTopLevelKeys.has(key),
  );
  return {
    exists: true,
    sha256: sha256(file),
    topLevelKeys,
    unsupportedTopLevelKeys,
    events: Object.keys(parsed.hooks || {}),
    hasRequiredEvents: requiredHookEvents.every((event) =>
      Boolean(parsed.hooks?.[event]),
    ),
    hasUnsupportedSuppressOutput: suppressPattern.test(text),
    commands,
    filterCommandCount: commands.filter((command) => command.usesFilter).length,
    versionCheckCommandCount: commands.filter(
      (command) => command.usesVersionCheck,
    ).length,
  };
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
    hookState[rel] = inspectHookFile(file);
  }

  const filter = path.join(plugin, "scripts", "codex-hook-output-filter.js");
  const installMarker = path.join(plugin, ".install-version");
  const skillScan = parseSkillDescriptions(plugin);

  return {
    activePlugin: plugin,
    version,
    overlay,
    overlayExists: fs.existsSync(overlay),
    localMarketplaceSnapshot: localMarketplaceRoot,
    localMarketplaceSnapshotExists: fs.existsSync(localMarketplaceRoot),
    marketplaceSnapshot: marketplaceRoot,
    marketplaceSnapshotExists: fs.existsSync(marketplaceRoot),
    targetRoots,
    installMarkerExists: fs.existsSync(installMarker),
    hookState,
    userHookState: inspectHookFile(codexUserHooksFile),
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
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  for (const target of state.targetRoots) {
    for (const rel of files) backupExisting(target.path, rel, stamp);
    fs.cpSync(state.overlay, target.path, { recursive: true });
  }
  return { ...state, appliedFiles: files };
}

function verify() {
  const state = inspect();
  const errors = [];
  const warnings = [];
  if (!state.installMarkerExists)
    errors.push("missing .install-version in active Codex cache");
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
      if (
        rel === "hooks/codex-hooks.json" &&
        !requiredHookEvents.every((event) => Boolean(parsed.hooks?.[event]))
      ) {
        errors.push(`${target.kind}:${rel} missing required hook events`);
      }
      if (rel === "hooks/codex-hooks.json") {
        const unsupportedTopLevelKeys = Object.keys(parsed).filter(
          (key) => !allowedCodexHookTopLevelKeys.has(key),
        );
        if (unsupportedTopLevelKeys.length > 0) {
          errors.push(
            `${target.kind}:${rel} has unsupported top-level keys: ${unsupportedTopLevelKeys.join(",")}`,
          );
        }
      }
      if (suppressPattern.test(text))
        errors.push(
          `${target.kind}:${rel} contains unsupported suppressOutput`,
        );
      if (rel === "hooks/codex-hooks.json" && !events.includes("PreToolUse")) {
        errors.push(`${target.kind}:${rel} missing PreToolUse`);
      }
      if (rel === "hooks/codex-hooks.json") {
        const unfilteredCodexHooks = collectHookCommands(parsed).filter(
          (command) =>
            command.command.includes('worker-service.cjs" hook codex') &&
            !command.command.includes("codex-hook-output-filter.js"),
        );
        for (const command of unfilteredCodexHooks) {
          errors.push(
            `${target.kind}:${rel} ${command.event}[${command.groupIndex}:${command.hookIndex}] does not pipe through codex-hook-output-filter.js`,
          );
        }
      }
    }
    if (
      !fs.existsSync(
        path.join(target.path, "scripts", "codex-hook-output-filter.js"),
      )
    ) {
      errors.push(`${target.kind}:scripts/codex-hook-output-filter.js missing`);
    }
  }
  for (const issue of state.skillDescriptionIssues) {
    errors.push(
      `${issue.file} description exceeds ${issue.max} chars (${issue.chars})`,
    );
  }
  if (state.userHookState.exists) {
    if (state.userHookState.hasUnsupportedSuppressOutput) {
      errors.push(
        "user-hooks:~/.codex/hooks.json contains unsupported suppressOutput",
      );
    }
    if (state.userHookState.filterCommandCount > 0 && !state.filterExists) {
      errors.push(
        "user-hooks:commands reference codex-hook-output-filter.js but active plugin filter is missing",
      );
    }
    const userVersionChecks = state.userHookState.commands.filter(
      (command) => command.usesVersionCheck,
    );
    const pluginVersionChecks = (
      state.hookState["hooks/codex-hooks.json"].commands || []
    ).filter((command) => command.usesVersionCheck);
    if (userVersionChecks.length > 0 && pluginVersionChecks.length > 0) {
      const pluginWithoutJson = pluginVersionChecks.filter(
        (command) => !command.printsContinue,
      );
      if (pluginWithoutJson.length > 0) {
        warnings.push(
          "SessionStart has user-level and plugin-owned version-check hooks; verify plugin-owned checks return JSON and not empty stdout",
        );
      }
    }
  }
  const hookSmokes = [];
  function assertNoSuppressOutput(stdout, label, options = {}) {
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
      const hasHookContext = Boolean(
        parsed.hookSpecificOutput?.additionalContext,
      );
      if (options.requireContinue !== false && parsed.continue !== true) {
        errors.push(`${label} did not return continue=true`);
      }
      if (
        options.allowHookSpecificOutput &&
        parsed.continue !== true &&
        !hasHookContext
      ) {
        errors.push(
          `${label} returned neither continue=true nor hookSpecificOutput.additionalContext`,
        );
      }
      return parsed;
    } catch {
      errors.push(`${label} emitted invalid JSON`);
      return null;
    }
  }

  if (state.filterExists) {
    const filter = path.join(
      state.activePlugin,
      "scripts",
      "codex-hook-output-filter.js",
    );
    const child = childProcess.spawnSync(
      process.execPath,
      [filter, "--event", "PostToolUse"],
      {
        input: '{"continue":true,"suppressOutput":true}\n',
        encoding: "utf8",
      },
    );
    if (child.status !== 0)
      errors.push("codex-hook-output-filter.js exited non-zero");
    else {
      const parsed = assertNoSuppressOutput(
        child.stdout,
        "codex-hook-output-filter.js",
      );
      if (parsed)
        hookSmokes.push({
          event: "filter",
          ok: true,
          keys: Object.keys(parsed),
        });
    }
  }

  const runner = path.join(state.activePlugin, "scripts", "bun-runner.js");
  const worker = path.join(state.activePlugin, "scripts", "worker-service.cjs");
  const filter = path.join(
    state.activePlugin,
    "scripts",
    "codex-hook-output-filter.js",
  );
  if (fs.existsSync(runner) && fs.existsSync(worker) && fs.existsSync(filter)) {
    const smokePayloads = [
      {
        event: "context",
        payload: {
          session_id: "codex-compat-verify",
          hook_event_name: "SessionStart",
          cwd: repoRoot,
          transcript_path: "/tmp/codex-compat-verify.jsonl",
        },
      },
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
      const filtered = childProcess.spawnSync(
        process.execPath,
        [filter, "--event", smoke.event],
        {
          input: child.stdout,
          encoding: "utf8",
        },
      );
      if (filtered.status !== 0) {
        errors.push(`hook ${smoke.event} filter exited non-zero`);
        continue;
      }
      const parsed = assertNoSuppressOutput(
        filtered.stdout,
        `hook ${smoke.event}`,
        {
          requireContinue: !["context", "file-context"].includes(smoke.event),
          allowHookSpecificOutput: ["context", "file-context"].includes(
            smoke.event,
          ),
        },
      );
      if (parsed && ["context", "file-context"].includes(smoke.event)) {
        if (Object.prototype.hasOwnProperty.call(parsed, "systemMessage")) {
          errors.push(`hook ${smoke.event} emitted top-level systemMessage`);
        }
        if (!parsed.hookSpecificOutput?.additionalContext) {
          errors.push(
            `hook ${smoke.event} did not emit hookSpecificOutput.additionalContext`,
          );
        }
      }
      if (parsed)
        hookSmokes.push({
          event: smoke.event,
          ok: true,
          keys: Object.keys(parsed),
        });
    }
  }

  return { ...state, ok: errors.length === 0, errors, warnings, hookSmokes };
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
