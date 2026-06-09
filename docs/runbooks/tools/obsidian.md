# Obsidian Second-Brain Runbook

Date: 2026-06-09
Status: Public optional second-brain runbook

## Purpose

Use Obsidian as a human-readable, durable project memory layer around Codex.
This is separate from `claude-mem`.

- `claude-mem` stores historical agent observations and powers `mcp-search`.
- Obsidian stores curated summaries, decisions, runbooks, and lessons that a
  human can read and maintain.

Do not use Obsidian as a raw transcript dump by default. Raw captures can be
useful as temporary evidence, but project notes should be promoted, concise,
dated, source-backed, and linked from an index.

## Safety

Do not store API keys, OAuth tokens, bearer tokens, private keys, passwords,
kubeconfigs, customer-sensitive data, or raw operational logs in Obsidian.

When summarizing work that touched secrets or private systems, record only safe
derived facts such as:

- which check passed or failed
- which public runbook or local file category changed
- which observation IDs or issue numbers were used
- what decision was made
- what verification remains

## Recommended Vault Layout

Use vault-relative paths so the workflow is portable:

```text
Codex/Inbox/YYYY-MM-DD/
Claude-Mem/Projects/<project>/
Claude-Mem/Projects/<project>/Index.md
Claude-Mem/Exports/
Claude-Mem/Templates/
```

Recommended meanings:

| Path | Use |
| --- | --- |
| `Codex/Inbox/YYYY-MM-DD/` | Raw or semi-raw local captures from hooks or manual exports |
| `Claude-Mem/Projects/<project>/` | Curated project notes that should survive future sessions |
| `Claude-Mem/Projects/<project>/Index.md` | Project map of content and note list |
| `Claude-Mem/Exports/` | Generated exports or historical digests |
| `Claude-Mem/Templates/` | Reusable note templates |

If the target machine uses a different vault structure, keep the same logical
boundary: raw inbox first, curated project notes second.

## Note Shape

Use frontmatter that makes AI-authored and human-reviewed boundaries explicit:

```yaml
---
project: example-project
date: 2026-06-09
status: current
type: curated-memory
origin: codex
ai_touched: true
human_reviewed: false
aliases:
  - example project memory
sources:
  claude-mem:
    - observation 12345
  codex-inbox: []
  local-verification:
    - docs/runbooks/example.md
supersedes: []
superseded_by: []
tags:
  - codex
  - curated-memory
---
```

Recommended sections:

```text
# Title

## Summary
## What Changed
## Decisions
## Evidence
## Risks
## Links
## Review Boundary
## Quality Gate
## Follow-Up
```

Keep each note readable without the original transcript. Include observation
IDs, issue numbers, commit hashes, or file paths when they help future
verification.

## Promotion Workflow

1. Search historical evidence first.

   Use `claude-mem` through `mcp-search` when available. If the current runtime
   cannot search directly, use the local memory registry or known observation
   IDs as fallback evidence.

2. Decide whether the content deserves a durable note.

   Good candidates:

   - architecture decisions
   - reusable runbook fixes
   - release or deploy lessons
   - incident root causes and validated fixes
   - project-specific operating rules

   Poor candidates:

   - routine command output
   - raw chat logs
   - temporary debug noise
   - secret-bearing settings or logs

3. Write or update one concise project note.

   Prefer updating an existing same-day note when it is the same workstream.
   Create a new note when the topic is meaningfully different.

4. Rebuild the project index.

   Use the target machine's index script if one exists. The source workstation
   used this shape:

   ```bash
   node ~/.codex/scripts/obsidian-project-index.cjs <project>
   ```

5. Verify the index links the new note.

   ```bash
   rg -n "<note-title>|<note-slug>" "<vault>/Claude-Mem/Projects/<project>/Index.md"
   ```

6. Mark the note quality gate.

   Keep the quality gate honest. If the note still needs human review, leave
   `human_reviewed: false`.

## Codex Integration Pattern

Codex can use Obsidian in two ways:

- read curated project notes when the user asks for durable context, decisions,
  or a second-brain summary
- write concise project notes after important completed work

Codex should not silently promote every session. Promotion is useful when the
future session would benefit from a stable summary that is easier to scan than
raw observations.

If a vault MCP server is available, configure it as a filesystem server pointing
at the vault root. Name does not matter, but this runbook uses
`obsidian-vault` as the example.

Example policy:

```text
Read Obsidian when the user asks for second-brain notes, durable summaries,
decisions, or knowledge-base material.

Write concise project notes after important completed work when it would help
future sessions.

Treat Codex/Inbox captures as raw local evidence. Promote only durable
summaries, decisions, and runbooks into project notes.
```

## Relationship To claude-mem

Keep the layers distinct:

| Layer | Primary Use | Read Path | Write Path |
| --- | --- | --- | --- |
| `claude-mem` | Agent history and observations | `mcp-search` | hooks or plugin worker |
| Obsidian inbox | Raw local evidence | vault file search | hook or manual capture |
| Obsidian project notes | Curated human-readable memory | vault file search or MCP | explicit promotion |

Do not migrate `claude-mem` wholesale into Obsidian unless there is a specific
export or archival goal. A better default is to link observation IDs and write a
short curated note.

## Quality Gate

- [ ] No secrets, tokens, private keys, or customer-sensitive raw data.
- [ ] Durable project knowledge, not routine command noise.
- [ ] Source observations, issues, commits, or local verification are listed.
- [ ] Current vs. historical status is clear.
- [ ] `origin`, `ai_touched`, and `human_reviewed` are accurate.
- [ ] Raw transcript shape was removed unless this is an explicitly raw archive.
- [ ] Aliases and links are present where they improve retrieval.
- [ ] Superseded older notes are marked when needed.
- [ ] The project index was rebuilt.
- [ ] The project index links the note.

## Troubleshooting

If Obsidian notes exist but future sessions do not use them:

- confirm the vault path is mounted and readable
- confirm the MCP filesystem server is enabled, if MCP access is expected
- confirm the project has an `Index.md`
- search the vault for the note title and aliases
- check whether the note is too raw or too generic to be useful

If a note contains too much raw output, rewrite it into decisions, evidence,
and next actions. Keep the raw capture in the inbox only when it is still useful
and safe to keep.
