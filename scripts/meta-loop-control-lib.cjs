"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const LEDGER_VERSION = 1;
const DEFAULT_LOCK_STALE_MS = 30_000;

function controlError(message, code) {
  const error = new Error(message);
  error.code = code || "META_LOOP_CONTROL";
  return error;
}

function nowIso(now) {
  return new Date(now || Date.now()).toISOString();
}

function readJson(file, label) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw controlError(`Cannot read ${label || "JSON"} at ${file}: ${error.message}`, "INVALID_JSON");
  }
  return parsed;
}

function validatePacket(packet) {
  const errors = [];
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) errors.push("packet must be an object");
  if (!packet || typeof packet.id !== "string" || !packet.id.trim()) errors.push("packet.id must be a non-empty string");
  if (!packet || typeof packet.objective !== "string" || !packet.objective.trim()) errors.push("packet.objective must be a non-empty string");
  if (packet && packet.workers !== undefined && (!Array.isArray(packet.workers) || packet.workers.some((worker) => typeof worker !== "string" || !worker.trim()))) {
    errors.push("packet.workers must be an array of non-empty strings when present");
  }
  return { valid: errors.length === 0, errors };
}

function newLedger(packet, options) {
  const check = validatePacket(packet);
  if (!check.valid) throw controlError(`Invalid packet: ${check.errors.join("; ")}`, "INVALID_PACKET");
  const capacity = Number(options && options.capacity || 1);
  if (!Number.isInteger(capacity) || capacity < 1) throw controlError("capacity must be a positive integer", "INVALID_CAPACITY");
  const createdAt = nowIso(options && options.now);
  const expiresAt = options && options.expiresAt || new Date(Date.parse(createdAt) + 60 * 60 * 1000).toISOString();
  if (Number.isNaN(Date.parse(expiresAt))) throw controlError("expiresAt must be an ISO timestamp", "INVALID_EXPIRY");
  return { version: LEDGER_VERSION, packet, capacity, createdAt, expiresAt, state: "open", workers: {}, events: [] };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function hasRequiredKeys(value, keys) {
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isIsoTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function assertLedger(ledger) {
  const invalid = () => {
    throw controlError("Ledger is invalid or uses an unsupported legacy format; create a new v1 ledger.", "INVALID_LEDGER");
  };
  if (!isPlainObject(ledger) || ledger.version !== LEDGER_VERSION) invalid();
  if (!hasOnlyKeys(ledger, ["version", "packet", "capacity", "createdAt", "expiresAt", "state", "workers", "events", "synthesis", "finishedAt"]) || !hasRequiredKeys(ledger, ["version", "packet", "capacity", "createdAt", "expiresAt", "state", "workers", "events"])) invalid();
  if (!validatePacket(ledger.packet).valid || !Number.isInteger(ledger.capacity) || ledger.capacity < 1) invalid();
  if (!isIsoTimestamp(ledger.createdAt) || !isIsoTimestamp(ledger.expiresAt) || !["open", "expired", "finished"].includes(ledger.state)) invalid();
  if (!isPlainObject(ledger.workers) || !Array.isArray(ledger.events)) invalid();
  for (const [workerId, worker] of Object.entries(ledger.workers)) {
    if (!workerId.trim() || !isPlainObject(worker) || !hasOnlyKeys(worker, ["status", "claimedAt", "attestation", "returnedAt", "result", "spawnedAt", "cancelledAt"]) || !hasRequiredKeys(worker, ["status", "claimedAt", "attestation", "returnedAt", "result"])) invalid();
    if (!["claimed", "spawned", "returned", "cancelled", "expired"].includes(worker.status) || !isIsoTimestamp(worker.claimedAt)) invalid();
    if (!(worker.attestation === null || (typeof worker.attestation === "string" && worker.attestation.trim()))) invalid();
    if (!(worker.returnedAt === null || isIsoTimestamp(worker.returnedAt)) || !(worker.result === null || (typeof worker.result === "string" && worker.result.trim()))) invalid();
    if (!(worker.spawnedAt === undefined || isIsoTimestamp(worker.spawnedAt)) || !(worker.cancelledAt === undefined || isIsoTimestamp(worker.cancelledAt))) invalid();
    if ((worker.status === "spawned" || worker.status === "returned") && (!worker.attestation || !worker.spawnedAt)) invalid();
    if (worker.status === "returned" && (!worker.returnedAt || !worker.result)) invalid();
    if (worker.status === "cancelled" && !worker.cancelledAt) invalid();
  }
  for (const item of ledger.events) {
    if (!isPlainObject(item) || !hasOnlyKeys(item, ["id", "at", "type", "worker", "detail"]) || !hasRequiredKeys(item, ["id", "at", "type", "worker", "detail"]) || typeof item.id !== "string" || !item.id || !isIsoTimestamp(item.at) || !["claimed", "spawn-confirmed", "returned", "cancelled", "expired", "synthesized", "finished"].includes(item.type) || !(item.worker === null || (typeof item.worker === "string" && item.worker.trim()))) invalid();
  }
  if (ledger.synthesis !== undefined) {
    if (!isPlainObject(ledger.synthesis) || !hasOnlyKeys(ledger.synthesis, ["at", "returns"]) || !hasRequiredKeys(ledger.synthesis, ["at", "returns"]) || !isIsoTimestamp(ledger.synthesis.at) || !Array.isArray(ledger.synthesis.returns)) invalid();
    for (const item of ledger.synthesis.returns) if (!isPlainObject(item) || !hasOnlyKeys(item, ["worker", "result"]) || !hasRequiredKeys(item, ["worker", "result"]) || typeof item.worker !== "string" || !item.worker.trim() || typeof item.result !== "string" || !item.result.trim()) invalid();
  }
  if (ledger.finishedAt !== undefined && !isIsoTimestamp(ledger.finishedAt)) invalid();
  if (ledger.state === "finished" && (!ledger.synthesis || !ledger.finishedAt)) invalid();
  return ledger;
}

function event(ledger, type, worker, now, detail) {
  ledger.events.push({ id: crypto.randomUUID(), at: nowIso(now), type, worker: worker || null, detail: detail || null });
}

function activeWorkers(ledger) {
  return Object.values(ledger.workers).filter((worker) => worker.status === "claimed" || worker.status === "spawned");
}

function reconcileLedger(ledger, options) {
  assertLedger(ledger);
  const now = nowIso(options && options.now);
  if (Date.parse(ledger.expiresAt) <= Date.parse(now) && ledger.state === "open") {
    ledger.state = "expired";
    for (const worker of Object.values(ledger.workers)) {
      if (worker.status === "claimed" || worker.status === "spawned") worker.status = "expired";
    }
    event(ledger, "expired", null, now);
  }
  return ledger;
}

function claim(ledger, workerId, options) {
  reconcileLedger(ledger, options);
  if (!workerId || !workerId.trim()) throw controlError("worker id is required", "INVALID_WORKER");
  if (ledger.state !== "open") throw controlError(`Cannot claim worker: ledger is ${ledger.state}.`, "LEDGER_CLOSED");
  if (ledger.synthesis) throw controlError("Cannot claim worker after synthesis; create a new wave.", "WAVE_SYNTHESIZED");
  if (ledger.workers[workerId]) throw controlError(`Worker ${workerId} already exists; duplicate claims are rejected.`, "DUPLICATE_WORKER");
  if (activeWorkers(ledger).length >= ledger.capacity) throw controlError(`Worker capacity ${ledger.capacity} is full.`, "CAPACITY_FULL");
  ledger.workers[workerId] = { status: "claimed", claimedAt: nowIso(options && options.now), attestation: null, returnedAt: null, result: null };
  event(ledger, "claimed", workerId, options && options.now);
  return ledger;
}

function confirmSpawn(ledger, workerId, attestation, options) {
  reconcileLedger(ledger, options);
  const worker = ledger.workers[workerId];
  if (!worker || worker.status !== "claimed") throw controlError(`Worker ${workerId} is not claimable for spawn confirmation.`, "INVALID_TRANSITION");
  if (!attestation || !attestation.trim()) throw controlError("A non-empty attestation is required to confirm spawn.", "MISSING_ATTESTATION");
  if (Object.values(ledger.workers).some((item) => item.attestation === attestation)) throw controlError("This attestation has already been recorded for another worker.", "DUPLICATE_ATTESTATION");
  // This is operator-recorded metadata, not evidence that a native spawn occurred.
  worker.status = "spawned";
  worker.attestation = attestation;
  worker.spawnedAt = nowIso(options && options.now);
  event(ledger, "spawn-confirmed", workerId, options && options.now, { attestation });
  return ledger;
}

function recordReturn(ledger, workerId, attestation, result, options) {
  reconcileLedger(ledger, options);
  const worker = ledger.workers[workerId];
  if (!worker || worker.status !== "spawned") throw controlError(`Worker ${workerId} is not awaiting a return.`, "INVALID_TRANSITION");
  if (!attestation || attestation !== worker.attestation) throw controlError("Return attestation does not match the explicit ledger attestation.", "ATTESTATION_MISMATCH");
  if (typeof result !== "string" || !result.trim()) throw controlError("A non-empty result is required.", "INVALID_RESULT");
  worker.status = "returned";
  worker.result = result;
  worker.returnedAt = nowIso(options && options.now);
  event(ledger, "returned", workerId, options && options.now);
  return ledger;
}

function cancel(ledger, workerId, options) {
  reconcileLedger(ledger, options);
  const worker = ledger.workers[workerId];
  if (!worker || (worker.status !== "claimed" && worker.status !== "spawned")) throw controlError(`Worker ${workerId} cannot be cancelled from its current state.`, "INVALID_TRANSITION");
  worker.status = "cancelled";
  worker.cancelledAt = nowIso(options && options.now);
  event(ledger, "cancelled", workerId, options && options.now);
  return ledger;
}

function synthesize(ledger, options) {
  reconcileLedger(ledger, options);
  if (ledger.state !== "open") throw controlError(`Cannot synthesize: ledger is ${ledger.state}.`, "LEDGER_CLOSED");
  const pending = activeWorkers(ledger);
  if (pending.length) throw controlError(`Cannot synthesize while ${pending.length} worker(s) remain active.`, "WORKERS_ACTIVE");
  const returns = Object.entries(ledger.workers).filter(([, worker]) => worker.status === "returned").map(([worker, item]) => ({ worker, result: item.result }));
  ledger.synthesis = { at: nowIso(options && options.now), returns };
  event(ledger, "synthesized", null, options && options.now);
  return ledger;
}

function finish(ledger, options) {
  reconcileLedger(ledger, options);
  if (!ledger.synthesis) throw controlError("Cannot finish before synthesis.", "MISSING_SYNTHESIS");
  if (ledger.state !== "open") throw controlError(`Cannot finish: ledger is ${ledger.state}.`, "LEDGER_CLOSED");
  const nonterminal = Object.values(ledger.workers).filter((worker) => !["returned", "cancelled", "expired"].includes(worker.status));
  if (nonterminal.length) throw controlError(`Cannot finish while ${nonterminal.length} worker(s) remain nonterminal.`, "WORKERS_ACTIVE");
  ledger.state = "finished";
  ledger.finishedAt = nowIso(options && options.now);
  event(ledger, "finished", null, options && options.now);
  return ledger;
}

function acquireLock(ledgerPath, options) {
  const lockPath = `${ledgerPath}.lock`;
  const configuredStaleMs = options && options.staleLockMs;
  const staleMs = configuredStaleMs === undefined ? DEFAULT_LOCK_STALE_MS : Number(configuredStaleMs);
  if (!Number.isFinite(staleMs) || staleMs <= 0) throw controlError(`staleLockMs must be a positive finite number (default ${DEFAULT_LOCK_STALE_MS}ms).`, "INVALID_STALE_LOCK_MS");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(lockPath, "wx", 0o600);
      const owner = { pid: process.pid, createdAt: nowIso(options && options.now), nonce: crypto.randomUUID() };
      fs.writeFileSync(fd, JSON.stringify(owner));
      return () => {
        try { fs.closeSync(fd); } finally {
          let current;
          try { current = JSON.parse(fs.readFileSync(lockPath, "utf8")); } catch (error) { if (error.code === "ENOENT") return; return; }
          if (current && current.nonce === owner.nonce) {
            try { fs.unlinkSync(lockPath); } catch (error) { if (error.code !== "ENOENT") throw error; }
          }
        }
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw controlError(`Cannot acquire ledger lock: ${error.message}`, "LOCK_ERROR");
      let snapshot;
      try {
        const stat = fs.statSync(lockPath);
        snapshot = { content: fs.readFileSync(lockPath, "utf8"), mtimeMs: stat.mtimeMs, ino: stat.ino, age: Date.now() - stat.mtimeMs };
      } catch (readError) { if (readError.code !== "ENOENT") throw readError; }
      if (attempt === 0 && snapshot && snapshot.age >= staleMs) {
        // Re-check the exact lock snapshot before removing it: a replacement owner must never be evicted.
        try {
          const stat = fs.statSync(lockPath);
          const content = fs.readFileSync(lockPath, "utf8");
          if (stat.mtimeMs === snapshot.mtimeMs && stat.ino === snapshot.ino && content === snapshot.content && Date.now() - stat.mtimeMs >= staleMs) fs.unlinkSync(lockPath);
        } catch (unlinkError) { if (unlinkError.code !== "ENOENT") throw unlinkError; }
        continue;
      }
      throw controlError(`Ledger is busy (${lockPath}). Wait for the writer or remove a lock older than ${staleMs}ms.`, "LOCKED");
    }
  }
}

function withLedger(ledgerPath, mutator, options) {
  const release = acquireLock(ledgerPath, options);
  try {
    const exists = fs.existsSync(ledgerPath);
    const ledger = exists ? assertLedger(readJson(ledgerPath, "ledger")) : null;
    const updated = mutator(ledger, exists);
    const temporary = `${ledgerPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(updated, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, ledgerPath);
    return updated;
  } finally { release(); }
}

module.exports = { LEDGER_VERSION, DEFAULT_LOCK_STALE_MS, validatePacket, newLedger, assertLedger, reconcileLedger, claim, confirmSpawn, recordReturn, cancel, synthesize, finish, acquireLock, withLedger, readJson };
