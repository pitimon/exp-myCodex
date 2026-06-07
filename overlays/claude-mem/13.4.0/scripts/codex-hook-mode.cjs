#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const pluginRoot = path.resolve(__dirname, "..");
const hookPath = path.join(pluginRoot, "hooks", "codex-hooks.json");

function load(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function save(config, mode) {
  const backup = `${hookPath}.bak-mode-${mode}-${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-")}`;
  fs.copyFileSync(hookPath, backup);
  fs.writeFileSync(hookPath, `${JSON.stringify(config, null, 2)}\n`);
  return backup;
}

function balancedPostToolUse() {
  const command = `_HP=$(printenv PATH 2>/dev/null || true); if [ -z "$_HP" ] && [ -n "\${SHELL:-}" ]; then _HP=$("$SHELL" -lc 'printf %s "$PATH"' 2>/dev/null || true); fi; _HP=$(printf '%s' "$_HP" | tr ' ' ':'); export PATH="\${_HP:+$_HP:}$PATH"; _C="\${CLAUDE_CONFIG_DIR:-$HOME/.claude}"; _E="\${CLAUDE_PLUGIN_ROOT:-\${PLUGIN_ROOT:-}}"; _A="${pluginRoot}"; _P=$({ [ -n "$_E" ] && printf '%s\\n' "$_E"; [ -d "$_A" ] && printf '%s\\n' "$_A"; ls -dt "$_C/plugins/cache/thedotmack/claude-mem"/[0-9]*/ 2>/dev/null; printf '%s\\n' "$_C/plugins/marketplaces/thedotmack/plugin"; } | while IFS= read -r _R; do _R="\${_R%/}"; [ -d "$_R/plugin/scripts" ] && _Q="$_R/plugin" || _Q="$_R"; [ -f "$_Q/scripts/codex-hook-spool.cjs" ] && { printf '%s\\n' "$_Q"; break; }; done); [ -n "$_P" ] || { echo '{"continue":true}'; exit 0; }; command -v cygpath >/dev/null 2>&1 && { _W=$(cygpath -w "$_P" 2>/dev/null); [ -n "$_W" ] && _P="$_W"; }; node "$_P/scripts/codex-hook-spool.cjs"`;
  return [
    {
      matcher: ".*",
      hooks: [
        {
          type: "command",
          command,
          timeout: 5,
        },
      ],
    },
  ];
}

function lifecycleOnly(config) {
  const next = structuredClone(config);
  delete next.hooks.PreToolUse;
  delete next.hooks.PostToolUse;
  return next;
}

function balanced(config) {
  const next = lifecycleOnly(config);
  next.hooks.PostToolUse = balancedPostToolUse();
  return next;
}

function status(config) {
  return {
    hookPath,
    hooks: Object.keys(config.hooks || {}),
    mode: config.hooks?.PreToolUse
      ? "full-or-custom"
      : config.hooks?.PostToolUse?.[0]?.hooks?.[0]?.command?.includes("codex-hook-spool.cjs")
        ? "balanced"
        : "incident",
    hasPreToolUse: Boolean(config.hooks?.PreToolUse),
    hasPostToolUse: Boolean(config.hooks?.PostToolUse),
    hasSuppressOutput: JSON.stringify(config).includes("suppressOutput"),
  };
}

const mode = process.argv[2] || "status";
const current = load(hookPath);

if (mode === "status") {
  console.log(JSON.stringify(status(current), null, 2));
  process.exit(0);
}

let next;
if (mode === "incident") {
  next = lifecycleOnly(current);
} else if (mode === "balanced") {
  next = balanced(current);
} else {
  console.error("Usage: codex-hook-mode.cjs status|incident|balanced");
  process.exit(2);
}

const backup = save(next, mode);
console.log(JSON.stringify({ mode, backup, ...status(next) }, null, 2));
