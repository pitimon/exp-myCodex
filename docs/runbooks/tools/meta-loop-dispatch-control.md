<!-- markdownlint-disable MD013 -->

# Bounded Dispatch Control for Meta Loops

Use this public pattern when a multi-agent workflow could duplicate work or replay a long conversation into several children. It controls context and evidence; it does not claim to intercept every platform-native spawn.

Start with the [Meta Loop Admission Gate](meta-loop-admission-gate.md) so the
orchestrator decides whether delegation is justified and creates the bounded
brief before this dispatch control applies.

## Default rule

Every child starts with a small context packet and no inherited conversation:

- objective and ownership boundary;
- in-scope and out-of-scope paths or questions;
- acceptance criteria and evidence locations;
- no-go decisions and required return format.

Workers, researchers, and deterministic checkers use bounded context. They do not receive the orchestrator's full transcript by default.

## Full-context exception

Full history is an exception for a reviewer only. Before dispatch, record:

1. why the bounded packet cannot answer the review question;
2. an approval reference from the run owner;
3. a stable task/evidence-scope fingerprint.

Allow one active full-context reviewer per run. Do not run it alongside a child with the same task or evidence scope. Synthesize the first result before creating a narrow follow-up.

## Managed receipt lifecycle

Use a managed wrapper around a native child request:

```text
validate packet -> reserve receipt -> native spawn -> attest returned ID
-> record return/evidence -> audit child telemetry -> reconcile -> synthesize
```

The wrapper should reject an active duplicate scope before spawning. A receipt is an audit record of the managed workflow, not independent proof that a native child existed, used a particular model, or made correct claims.

## Telemetry audit and hold

After a non-trivial run, map each managed receipt to the child session and separate uncached input, cached input, and output counts where the runtime exposes them. Record unavailable data as unavailable; never assign the root session total to a child.

If evidence shows a bounded receipt but a forked child, an unmatched child session, or incomplete child attribution, raise a control violation and hold reconciliation/synthesis. Resolving it requires an approver, approval reference, disposition, evidence reference, and a concise human-readable reason. Do not clear a violation by changing a status label alone.

## Platform boundary

This is fail-closed for work that uses the managed wrapper. A direct native spawn can bypass that wrapper; a local ledger cannot reliably prevent or discover every such event at dispatch time. Treat later session inspection as an audit signal, disclose the coverage gap, and do not call it complete managed coverage.

## Scenario checks

Run harmless fixture scenarios after changing the wrapper:

- bounded worker is accepted without full history;
- missing full-context approval is rejected before spawn;
- a second active full-context reviewer is rejected;
- duplicate task/evidence scope is rejected;
- bounded receipt plus observed fork creates a violation and blocks synthesis;
- complete child attribution permits reconciliation;
- only a fully documented human resolution releases a held run.

Collect 5--10 comparable runs before setting a numeric cache-read budget. Compare context mode, child count, cached-input mix, and evidence-backed outcomes; one incident is evidence for a guardrail, not a calibrated threshold.

## Public boundary

Publish the contract, fixtures, and validation outcomes. Do not publish raw session logs, prompts, local paths, account metadata, customer evidence, or token records that identify a private workload.
