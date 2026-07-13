# Meta Loop Admission Gate

Use an admission gate before delegating a multi-agent task. Its job is to
decide whether delegation is useful and to create a small, task-specific brief;
it is not a requirement for every worker to repeat a planning workflow.

## Admission decisions

Record each decision as completed or skipped, with a reason for every skip:

| Decision    | Required when                                                  | Result                                                         |
| ----------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| Investigate | facts, evidence, or prior pattern are unclear                  | source references or skip reason                               |
| Define      | every non-trivial child task                                   | objective, scope, acceptance criteria, no-go decisions         |
| Decide      | architecture, security, infrastructure, or irreversible impact | decision record or skip reason                                 |
| Decompose   | two or more children are planned                               | atomic ownership, evidence, and merge boundary                 |
| Brief       | every child                                                    | only the paths, commands, evidence, and return format it needs |

The Define and Brief decisions are mandatory for a dispatched child. Decompose
is mandatory for a multi-child wave. A worker should execute its owned brief,
not repeat the whole admission workflow.

## Full-context exception

Default to a bounded brief. If a reviewer needs full history, record why the
brief is insufficient, the evidence supporting that conclusion, and an
approval reference. Limit the exception and do not run overlapping reviews in
parallel.

## After dispatch

Use review against the synthesized evidence. Apply deployment and monitoring
steps only when the task changes a running system. Measure child context mode,
duplicate suppression, and outcome across comparable runs before setting a
numeric cache-read budget.

## Public boundary

Publish the decision contract and synthetic scenario outcomes only. Do not
publish prompts, raw session history, machine paths, account metadata, or
workload-specific token records.
