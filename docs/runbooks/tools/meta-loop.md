# Meta-Loop Control Runbook

Date: 2026-07-12
Status: Public workflow-only control ledger

## Purpose

`scripts/meta-loop-control.cjs` maintains a small JSON ledger for a bounded
multi-worker task. It validates a task packet, records worker claims and
operator attestations, records returned results, then produces a synthesis
record and closes the ledger.

It is a local coordination aid, not an agent launcher, scheduler, identity
provider, or authorization system. Keep each packet, ledger, result, and
attestation free of secrets, customer data, raw private logs, and access
tokens. Store a ledger only where the task's data is allowed to live.

## Packet And Ledger Contract

A packet must be a JSON object with non-empty string `id` and `objective`.
It may also have `workers`, an array of non-empty worker IDs. A new ledger has
version `1`, a positive capacity (default `1`), and an expiry one hour after
creation unless `--expires-at` supplies an ISO timestamp.

The ledger state is `open`, `expired`, or `finished`. Worker states are:

```text
claimed -> spawned -> returned
                  -> cancelled
claimed ------------> cancelled
claimed/spawned ----> expired (when an open ledger expires)
```

`reconcile` applies expiry. Every mutating command also reconciles first, so
an expired open ledger rejects new claims and marks active workers expired.
`synthesize` is allowed only while the ledger is open and has no claimed or
spawned workers. `finish` requires a prior synthesis and changes the ledger to
`finished`. Do not edit the JSON by hand to bypass a transition.

## Safe Temporary-Ledger Dry Run

Run this from a local checkout. It creates and removes only a temporary
directory; it does not launch a worker or contact a service.

<!-- markdownlint-disable MD013 -->

```bash
set -e
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
packet="$tmp_dir/packet.json"
ledger="$tmp_dir/ledger.json"

printf '%s\n' '{"id":"docs-dry-run","objective":"validate ledger lifecycle"}' > "$packet"

node scripts/meta-loop-control.cjs validate-packet --packet "$packet"
node scripts/meta-loop-control.cjs claim --ledger "$ledger" --packet "$packet" --worker docs-worker --capacity 1 --expires-at 2099-01-01T00:00:00.000Z
node scripts/meta-loop-control.cjs confirm-spawn --ledger "$ledger" --worker docs-worker --attestation docs-attestation-1
node scripts/meta-loop-control.cjs record-return --ledger "$ledger" --worker docs-worker --attestation docs-attestation-1 --result "dry run complete"
node scripts/meta-loop-control.cjs synthesize --ledger "$ledger"
node scripts/meta-loop-control.cjs finish --ledger "$ledger"
```

<!-- markdownlint-enable MD013 -->

Each successful command prints the full updated JSON ledger. The last result
has `state: "finished"` and a `synthesis` record containing `docs-worker`.
For syntax-only validation, stop after `validate-packet`; it does not create or
change a ledger. The bootstrap's validate-only check instead runs the complete
synthetic lifecycle above in a temporary directory; it still does not launch a
worker or retain persistent state.

## Bootstrap Validation Boundary

The new-workstation bootstrap treats Meta-Loop Control as `validate-only`.
First decide whether multi-agent coordination is in scope. If it is not,
report `meta_loop=skipped:out-of-scope` without checking Meta-Loop
prerequisites. For an in-scope check, confirm that Node works in the active
execution context and that the local checkout contains
`scripts/meta-loop-control.cjs`. Create a temporary directory only in the
mutation-capable validation step, after those checks pass; `set -e` and the
cleanup trap make the lifecycle fail closed and remove that directory after a
successful creation. A missing prerequisite is `meta_loop=blocked:<reason>`.
Do not invent a path, install a hook, retain a ledger, or start a worker to
satisfy bootstrap validation.

When the temporary lifecycle completes, report `meta_loop=validated` with the
CLI path, `node --version`, and lifecycle result. Also report that lock recovery
is trusted-local mtime recovery only and an attestation is not native-spawn
proof. Remove the temporary directory after the check. The ledger never
launches, observes, authenticates, or authorizes a worker.

## Managed Attestation Boundary

`confirm-spawn` requires a non-empty, unique `--attestation`; `record-return`
requires that exact attestation. This links an operator-recorded claim to a
recorded return and prevents reuse inside one ledger.

The attestation is metadata, not proof that this CLI launched, observed, or
authenticated a native worker spawn. The CLI never spawns a worker. If a
native spawn occurs outside a managed wrapper, record it only as an
operator-provided statement and describe the independent evidence separately.
Do not represent an unwrapped native spawn as managed, verified, or enforced
by this ledger.

Use opaque, non-sensitive attestation labels. Do not put tokens, command
output, private paths, or provider-specific credentials in an attestation or
`--result` value.

## Native Spawn Correlation Boundary

The control ledger is not a native-runtime correlation adapter. A native child
identifier must be bound to the exact dispatch before it can be used as a
release gate for higher fan-out. The following evidence is useful for a later
audit, but is not that binding:

- a ledger attestation;
- an application-server spawn-event candidate that has not passed a live
  causal and replay-safety scenario;
- later session metadata, polling output, or local activity history; or
- an observed subagent-activity child identifier with no direct dispatch
  binding.

In a bounded live probe on 2026-07-13, a child appeared in local session
metadata but was not immediately available through App Server `thread/list`;
an already-subscribed App Server connection also emitted no `thread/started`
notification for that native collaboration spawn. In the verified Codex
0.144.1 boundary, neither the available application-server spawn-event
candidate nor later metadata established a safe dispatch-time
native-correlation contract. Do not infer the missing binding from timing,
task text, worker names, or a session identifier. A session identifier may
support post-run token or activity audit, but is not a native child identifier
for dispatch control.

Keep native work at no more than three children per wave while this boundary
holds. Do not raise that cap until one of these conditions is demonstrated in a
harmless live scenario on the target runtime:

1. The native spawn API returns the child thread identifier directly; or
2. A documented event contract provides a causal, replay-safe binding from the
   dispatch to exactly one child thread identifier.

For either condition, pre-subscribe before the spawn when events are used, then
prove the expected parent and dispatch binding, one-to-one child mapping,
bounded delivery time, and safe failure on missing, duplicate, late, or
mismatched identifiers. A mock-only test, a later history query, or a child ID
seen after the fact cannot replace this scenario. If the evidence is absent or
ambiguous, hold the high-fan-out wave and retain the cap of three.

## Single-Writer Lock And Stale Recovery

Every command that writes a ledger uses `<ledger>.lock` as an exclusive,
single-writer lock and writes the updated ledger through a temporary file plus
rename. If another writer holds the lock, the command fails instead of merging
concurrent edits.

The default stale-lock age is 30,000 ms. A mutating command can use
`--stale-lock-ms N` to set a different age. On its first acquisition attempt,
the CLI removes a lock whose filesystem modification time is at least that old,
then retries once. This is mtime-based recovery only: the CLI does not verify
the prior lock owner's identity, process liveness, or authorization. A stale
mtime is not proof that a writer is gone, so use this only in a trusted,
single-operator context after independently confirming no live writer owns the
ledger. A low threshold can steal a slow active writer's lock.

<!-- markdownlint-disable MD013 -->

```bash
node scripts/meta-loop-control.cjs reconcile --ledger ./task-ledger.json --stale-lock-ms 30000
```

<!-- markdownlint-enable MD013 -->

If the ledger is busy and it is not known stale, wait for its writer and retry.
Do not delete a current lock manually. If stale recovery repeatedly occurs,
preserve safe diagnostic facts (timestamp, command, and ledger location) and
investigate the interrupted writer before continuing. Do not treat this lock as
an ownership-safe coordination mechanism across untrusted users or hosts.

## Operating Sequence

1. Create and validate a minimal packet with `validate-packet --packet FILE`.
2. Create the ledger and reserve one worker with
   `claim --ledger FILE --packet FILE --worker ID`; set `--capacity N` and
   `--expires-at ISO` only on this first claim.
3. After independently recording the relevant spawn evidence, use
   `confirm-spawn --ledger FILE --worker ID --attestation LABEL`.
4. Record one non-empty outcome with
   `record-return --ledger FILE --worker ID --attestation LABEL --result TEXT`,
   or use `cancel --ledger FILE --worker ID` for a claimed or spawned worker
   that will not return.
5. Run `reconcile --ledger FILE` if expiry may have passed. Once no worker is
   active, run `synthesize --ledger FILE`, then `finish --ledger FILE`.

For command discovery, run `node scripts/meta-loop-control.cjs --help`; it
prints the usage summary to stdout and exits zero. A missing or invalid action
prints usage to stderr and exits nonzero. The supported actions are:

```text
validate-packet
claim
confirm-spawn
record-return
cancel
reconcile
synthesize
finish
```

## Definition Of Done

- [ ] The packet validates and contains no sensitive content.
- [ ] Capacity, expiry, and worker IDs fit the intended bounded task.
- [ ] Each recorded spawn and return has an explicit, non-sensitive
      attestation, with independent evidence retained outside the ledger when
      needed.
- [ ] Any proposed native fan-out above three has a direct child-ID return or a
      documented causal, replay-safe event contract that passed the live
      scenario described above; otherwise the wave is held.
- [ ] No active worker remains before synthesis.
- [ ] The ledger is synthesized, finished, and preserved or removed according
      to the task's retention policy.
- [ ] Any stale-lock recovery was reviewed; no active lock was removed by hand.
