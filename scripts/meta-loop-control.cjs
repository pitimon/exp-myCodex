#!/usr/bin/env node
"use strict";

const fs = require("fs");
const lib = require("./meta-loop-control-lib.cjs");

function fail(message) { process.stderr.write(`Error: ${message}\n`); process.exitCode = 1; }
function args(values) {
  const result = { _: [] };
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (!value.startsWith("--")) result._.push(value);
    else { const key = value.slice(2); result[key] = values[i + 1] && !values[i + 1].startsWith("--") ? values[++i] : true; }
  }
  return result;
}
function packet(value) { return JSON.parse(fs.readFileSync(value, "utf8")); }
function output(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }
function required(a, name) { if (!a[name] || a[name] === true) throw new Error(`--${name} is required`); return a[name]; }
function mutate(a, fn) {
  const ledgerPath = required(a, "ledger");
  const staleLockMs = a["stale-lock-ms"] === undefined ? undefined : Number(a["stale-lock-ms"]);
  return lib.withLedger(ledgerPath, fn, { staleLockMs });
}
function usage() {
  return "Usage: meta-loop-control.cjs validate-packet --packet FILE | claim --ledger FILE --packet FILE --worker ID [--capacity N] [--expires-at ISO] | confirm-spawn|record-return|cancel|reconcile|synthesize|finish --ledger FILE [--stale-lock-ms MS]\n\n--stale-lock-ms must be a positive finite number; default: 30000ms.";
}

try {
  const a = args(process.argv.slice(2)); const command = a._[0];
  if (command === "--help" || command === "-h" || a.help) { process.stdout.write(`${usage()}\n`); }
  else if (command === "validate-packet") { const value = packet(required(a, "packet")); const result = lib.validatePacket(value); output(result); if (!result.valid) process.exitCode = 1; }
  else if (command === "claim") output(mutate(a, (ledger) => { if (!ledger) return lib.claim(lib.newLedger(packet(required(a, "packet")), { capacity: a.capacity, expiresAt: a["expires-at"] }), required(a, "worker")); return lib.claim(ledger, required(a, "worker")); }));
  else if (command === "confirm-spawn") output(mutate(a, (ledger) => lib.confirmSpawn(ledger, required(a, "worker"), required(a, "attestation"))));
  else if (command === "record-return") output(mutate(a, (ledger) => lib.recordReturn(ledger, required(a, "worker"), required(a, "attestation"), required(a, "result"))));
  else if (command === "cancel") output(mutate(a, (ledger) => lib.cancel(ledger, required(a, "worker"))));
  else if (command === "reconcile") output(mutate(a, (ledger) => lib.reconcileLedger(ledger)));
  else if (command === "synthesize") output(mutate(a, (ledger) => lib.synthesize(ledger)));
  else if (command === "finish") output(mutate(a, (ledger) => lib.finish(ledger)));
  else fail(usage());
} catch (error) { fail(error.message); }
