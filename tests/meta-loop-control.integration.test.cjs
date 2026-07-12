"use strict";

const assert = require("assert");
const child = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const lib = require("../scripts/meta-loop-control-lib.cjs");
const root = path.resolve(__dirname, ".."); const cli = path.join(root, "scripts/meta-loop-control.cjs");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "meta-loop-control-"));
const ledger = path.join(temp, "ledger.json"); const packet = path.join(temp, "packet.json");
fs.writeFileSync(packet, JSON.stringify({ id: "integration", objective: "exercise cli" }));
function run(...argv) { return child.spawnSync(process.execPath, [cli, ...argv], { encoding: "utf8" }); }
assert.strictEqual(run("validate-packet", "--packet", packet).status, 0);
assert.strictEqual(run("--help").status, 0);
assert.match(run("--help").stdout, /default: 30000ms/);
assert.strictEqual(run("claim", "--ledger", ledger, "--packet", packet, "--worker", "worker-1", "--capacity", "1").status, 0);
assert.notStrictEqual(run("claim", "--ledger", ledger, "--worker", "worker-1").status, 0);
assert.strictEqual(run("confirm-spawn", "--ledger", ledger, "--worker", "worker-1", "--attestation", "manual-proof").status, 0);
assert.strictEqual(run("record-return", "--ledger", ledger, "--worker", "worker-1", "--attestation", "manual-proof", "--result", "done").status, 0);
assert.strictEqual(run("synthesize", "--ledger", ledger).status, 0);
assert.strictEqual(run("finish", "--ledger", ledger).status, 0);
const invalidStaleArg = run("reconcile", "--ledger", ledger, "--stale-lock-ms", "0");
assert.notStrictEqual(invalidStaleArg.status, 0);
assert.match(invalidStaleArg.stderr, /positive finite/i);
fs.writeFileSync(`${ledger}.lock`, "busy");
assert.throws(() => lib.acquireLock(ledger, { staleLockMs: 999999 }), /busy/);
assert.throws(() => lib.acquireLock(ledger, { staleLockMs: 0 }), /positive finite/i);
assert.throws(() => lib.acquireLock(ledger, { staleLockMs: Infinity }), /positive finite/i);
fs.utimesSync(`${ledger}.lock`, new Date(0), new Date(0)); const release = lib.acquireLock(ledger, { staleLockMs: 1 }); release();
assert.strictEqual(fs.existsSync(`${ledger}.lock`), false);
const priorOwner = lib.acquireLock(ledger);
fs.unlinkSync(`${ledger}.lock`);
const replacementOwner = lib.acquireLock(ledger);
priorOwner();
assert.strictEqual(fs.existsSync(`${ledger}.lock`), true, "prior owner must not release replacement lock");
replacementOwner();
assert.strictEqual(fs.existsSync(`${ledger}.lock`), false);
const lockPath = `${ledger}.lock`;
fs.writeFileSync(lockPath, JSON.stringify({ pid: 1, createdAt: "1970-01-01T00:00:00.000Z", nonce: "stale-owner" }));
fs.utimesSync(lockPath, new Date(0), new Date(0));
const originalReadFileSync = fs.readFileSync; let lockReads = 0;
fs.readFileSync = function patchedReadFileSync(file, ...rest) {
  if (file === lockPath && ++lockReads === 2) {
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 2, createdAt: new Date().toISOString(), nonce: "replacement-owner" }));
  }
  return originalReadFileSync.call(fs, file, ...rest);
};
try {
  assert.throws(() => lib.acquireLock(ledger, { staleLockMs: 1 }), /busy/);
} finally {
  fs.readFileSync = originalReadFileSync;
}
assert.match(fs.readFileSync(lockPath, "utf8"), /replacement-owner/, "stale recovery must recheck before removing a lock");
fs.unlinkSync(lockPath);
fs.rmSync(temp, { recursive: true, force: true });
process.stdout.write("meta-loop-control integration tests passed\n");
