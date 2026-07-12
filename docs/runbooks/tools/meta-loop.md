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
For a validation-only check, stop after `validate-packet`; it does not create
or change a ledger.

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
- [ ] No active worker remains before synthesis.
- [ ] The ledger is synthesized, finished, and preserved or removed according
      to the task's retention policy.
- [ ] Any stale-lock recovery was reviewed; no active lock was removed by hand.
