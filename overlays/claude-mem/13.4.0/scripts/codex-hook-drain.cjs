#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const PLUGIN_ROOT =
  process.env.CLAUDE_MEM_PLUGIN_ROOT ||
  path.resolve(__dirname, "..");
const SPOOL_ROOT =
  process.env.CLAUDE_MEM_CODEX_HOOK_SPOOL_DIR ||
  path.join(os.homedir(), ".claude-mem", "codex-hook-spool");
const QUEUE_DIR = path.join(SPOOL_ROOT, "queue");
const DONE_DIR = path.join(SPOOL_ROOT, "done");
const FAILED_DIR = path.join(SPOOL_ROOT, "failed");
const LOG_DIR = path.join(SPOOL_ROOT, "logs");
const LOCK_DIR = path.join(SPOOL_ROOT, "drain.lock");
const MAX_EVENTS_PER_RUN = Number(process.env.CLAUDE_MEM_CODEX_HOOK_DRAIN_MAX_EVENTS || 20);
const EVENT_TIMEOUT_MS = Number(process.env.CLAUDE_MEM_CODEX_HOOK_DRAIN_TIMEOUT_MS || 15000);

function mkdir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function log(message) {
  try {
    mkdir(LOG_DIR);
    fs.appendFileSync(path.join(LOG_DIR, "drain.log"), `${new Date().toISOString()} ${message}\n`, {
      mode: 0o600,
    });
  } catch {
    // Background drain logging must never affect Codex.
  }
}

function acquireLock() {
  mkdir(SPOOL_ROOT);
  try {
    fs.mkdirSync(LOCK_DIR, { mode: 0o700 });
    fs.writeFileSync(path.join(LOCK_DIR, "pid"), `${process.pid}\n`);
    return true;
  } catch {
    return false;
  }
}

function releaseLock() {
  try {
    fs.rmSync(LOCK_DIR, { recursive: true, force: true });
  } catch {
    // Best-effort stale lock cleanup is handled by later manual inspection.
  }
}

function readQueueFiles() {
  try {
    return fs
      .readdirSync(QUEUE_DIR)
      .filter((name) => name.endsWith(".jsonl"))
      .sort()
      .map((name) => path.join(QUEUE_DIR, name));
  } catch {
    return [];
  }
}

function splitFirstLine(file) {
  const content = fs.readFileSync(file, "utf8");
  if (!content.trim()) {
    fs.rmSync(file, { force: true });
    return null;
  }
  const newline = content.indexOf("\n");
  const line = newline === -1 ? content : content.slice(0, newline);
  const rest = newline === -1 ? "" : content.slice(newline + 1);
  fs.writeFileSync(file, rest, { mode: 0o600 });
  return line;
}

function archive(dir, payload) {
  mkdir(dir);
  const name = `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}.json`;
  fs.writeFileSync(path.join(dir, name), `${payload}\n`, { mode: 0o600 });
}

function ingest(line) {
  const worker = path.join(PLUGIN_ROOT, "scripts", "worker-service.cjs");
  const runner = path.join(PLUGIN_ROOT, "scripts", "bun-runner.js");
  const result = spawnSync(process.execPath, [runner, worker, "hook", "codex", "observation"], {
    input: line,
    encoding: "utf8",
    timeout: EVENT_TIMEOUT_MS,
    env: {
      ...process.env,
      CLAUDE_MEM_CODEX_HOOK_DRAIN: "1",
    },
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`worker hook exited ${result.status}: ${(result.stderr || result.stdout || "").slice(0, 500)}`);
  }
}

(function main() {
  if (!acquireLock()) return;
  let processed = 0;

  try {
    for (const file of readQueueFiles()) {
      while (processed < MAX_EVENTS_PER_RUN) {
        const line = splitFirstLine(file);
        if (!line) break;
        try {
          ingest(line);
          archive(DONE_DIR, line);
        } catch (error) {
          archive(FAILED_DIR, JSON.stringify({
            failed_at: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
            payload: line,
          }));
          log(`failed ${error instanceof Error ? error.message : String(error)}`);
        }
        processed += 1;
      }
      try {
        if (fs.existsSync(file) && fs.statSync(file).size === 0) fs.rmSync(file, { force: true });
      } catch {
        // Ignore queue cleanup errors.
      }
      if (processed >= MAX_EVENTS_PER_RUN) break;
    }
  } finally {
    releaseLock();
  }
})();
