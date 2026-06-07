#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const PLUGIN_ROOT = path.resolve(__dirname, "..");
const SPOOL_ROOT =
  process.env.CLAUDE_MEM_CODEX_HOOK_SPOOL_DIR ||
  path.join(os.homedir(), ".claude-mem", "codex-hook-spool");
const QUEUE_DIR = path.join(SPOOL_ROOT, "queue");
const MAX_STRING_CHARS = Number(process.env.CLAUDE_MEM_CODEX_HOOK_MAX_STRING_CHARS || 8192);
const SKIP_OVER_BYTES = Number(process.env.CLAUDE_MEM_CODEX_HOOK_SKIP_OVER_BYTES || 8 * 1024 * 1024);
const MAX_RAW_BYTES = Number(process.env.CLAUDE_MEM_CODEX_HOOK_MAX_RAW_BYTES || SKIP_OVER_BYTES);
const SENSITIVE_KEY_RE = /(?:token|secret|password|passwd|authorization|api[_-]?key|private[_-]?key|credential)/i;
const SENSITIVE_LINE_RE = /((?:token|secret|password|passwd|authorization|api[_-]?key|private[_-]?key|credential)["'\s:=]+)([^"',\s}]+)/gi;

function ok() {
  process.stdout.write(JSON.stringify({ continue: true }));
}

function safeMkdir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function readStdinCapped() {
  return new Promise((resolve) => {
    const chunks = [];
    let total = 0;
    let overHardLimit = false;

    process.stdin.on("data", (chunk) => {
      total += chunk.length;
      if (total > SKIP_OVER_BYTES) {
        overHardLimit = true;
        process.stdin.pause();
        process.stdin.destroy();
        return;
      }
      if (Buffer.concat(chunks).length < MAX_RAW_BYTES) {
        chunks.push(chunk);
      }
    });
    process.stdin.on("error", () => resolve({ raw: "", total, overHardLimit, readError: true }));
    process.stdin.on("end", () => {
      const raw = Buffer.concat(chunks).subarray(0, MAX_RAW_BYTES).toString("utf8");
      resolve({ raw, total, overHardLimit, readError: false });
    });
  });
}

function truncateString(value) {
  if (value.length <= MAX_STRING_CHARS) return value;
  return `${value.slice(0, MAX_STRING_CHARS)}\n[claude-mem codex hook truncated ${value.length - MAX_STRING_CHARS} chars]`;
}

function redactString(value) {
  return value.replace(SENSITIVE_LINE_RE, "$1[redacted]");
}

function sanitize(value, key = "", depth = 0, seen = new WeakSet()) {
  if (SENSITIVE_KEY_RE.test(key)) return "[redacted by claude-mem codex hook]";
  if (typeof value === "string") return truncateString(redactString(value));
  if (value === null || typeof value !== "object") return value;
  if (depth > 8) return "[truncated object depth]";
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    const maxItems = 80;
    const out = value.slice(0, maxItems).map((item) => sanitize(item, "", depth + 1, seen));
    if (value.length > maxItems) out.push(`[truncated ${value.length - maxItems} array items]`);
    return out;
  }

  const out = {};
  const entries = Object.entries(value);
  const maxKeys = 120;
  for (const [childKey, childValue] of entries.slice(0, maxKeys)) {
    out[childKey] = sanitize(childValue, childKey, depth + 1, seen);
  }
  if (entries.length > maxKeys) out.__claude_mem_truncated_keys = entries.length - maxKeys;
  return out;
}

function queueFileName() {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return path.join(QUEUE_DIR, `${day}.jsonl`);
}

function spawnDrain() {
  const drainScript = path.join(__dirname, "codex-hook-drain.cjs");
  const child = spawn(process.execPath, [drainScript], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      CLAUDE_MEM_PLUGIN_ROOT: PLUGIN_ROOT,
      CLAUDE_MEM_CODEX_HOOK_SPOOL_DIR: SPOOL_ROOT,
    },
  });
  child.unref();
}

(async function main() {
  try {
    const input = await readStdinCapped();
    safeMkdir(QUEUE_DIR);

    let payload;
    try {
      payload = sanitize(JSON.parse(input.raw || "{}"));
    } catch (error) {
      payload = {
        hook_event_parse_error: error instanceof Error ? error.message : String(error),
        raw_preview: truncateString(redactString(input.raw || "")),
      };
    }

    payload.__claude_mem_codex_hook = {
      spooled_at: new Date().toISOString(),
      raw_bytes_seen: input.total,
      raw_bytes_captured: Buffer.byteLength(input.raw || "", "utf8"),
      raw_over_hard_limit: input.overHardLimit,
      read_error: input.readError,
      mode: "balanced-spool",
    };

    fs.appendFileSync(queueFileName(), `${JSON.stringify(payload)}\n`, { mode: 0o600 });
    spawnDrain();
  } catch (error) {
    const logDir = path.join(SPOOL_ROOT, "logs");
    try {
      safeMkdir(logDir);
      fs.appendFileSync(
        path.join(logDir, "spool-errors.log"),
        `${new Date().toISOString()} ${error instanceof Error ? error.stack || error.message : String(error)}\n`,
        { mode: 0o600 },
      );
    } catch {
      // The hook must fail open even if local logging is unavailable.
    }
  } finally {
    ok();
  }
})();
