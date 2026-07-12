# Meta-Loop Control Validation Prompt

Use this prompt from a local checkout when validating the public Meta-Loop
Control workflow:

```text
You are validating the public Meta-Loop Control ledger workflow.

Read these files first:

1. docs/README.md
2. docs/manifests/codex-tools.yaml
3. docs/runbooks/tools/meta-loop.md
4. this prompt
5. scripts/meta-loop-control.cjs

Run the Safe Temporary-Ledger Dry Run from the runbook exactly from a local
checkout. Keep all packet, ledger, attestation, and result values synthetic and
non-sensitive. Do not use a production task, contact a service, launch a
worker, or delete an existing lock.

For CLI discovery, run `node scripts/meta-loop-control.cjs --help`; it prints
usage to stdout and exits zero. A missing or invalid action prints usage to
stderr and exits nonzero. Treat only the `--help` invocation as a passing
discovery smoke test.

Verify and report:

- packet validation result
- lifecycle result: claim, confirm-spawn, record-return, synthesize, finish
- final ledger state and returned worker result
- that the test ledger was temporary and cleaned up
- the single-writer lock behavior and stale-lock limitation: recovery is based
  only on the lock mtime and does not verify owner identity or process liveness
- the managed-attestation boundary: confirm-spawn records operator metadata;
  it does not prove or execute a native worker spawn

Do not call an unwrapped native spawn managed or verified by this tool. Do not
print secrets, tokens, private paths, private issue links, or provider bridge
details. Do not treat the lock as ownership-safe across untrusted users or
hosts. If a check is skipped or cannot be proven, say so plainly.
```
