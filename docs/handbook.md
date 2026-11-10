# MQTT Lifecycle Reliability Lab handbook

By Jason Stys.

Rehearse MQTT lifecycle failures, redelivery, stale state and bounded offline recovery through deterministic scenarios. Inspect identity-bound checkpoints and loss accounting while preserving original measurement timestamps and explicit at-least-once limits.

Persist and restore identity-bound bounded recovery outboxes with original times, TTL/capacity losses and publish-failure retention.

Turns reconnect demonstrations into reproducible cold-recovery workflows with explicit at-least-once limits.

## Read the documentation

| Edition                                          | Audience and contents                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| [project-guide.docx](reports/project-guide.docx) | User and developer guide: purpose, current usage, design, boundaries and source references. |

The editable Markdown remains the maintenance source. The Word files are readable editions. See [publication identities and review](reports/publications.json) and the [documentation refresh record](reports/documentation-refresh-2026-11-09.md).

## Current usage and help

[README quick start](../README.md) is the entry point. Use the project-specific guides below before changing inputs, operating modes or deployment assumptions.

### Usage and operations

- [checkpoint recovery](checkpoint-recovery.md)
- [runbook](runbook.md)

### Design and contracts

- [architecture](architecture.md)

### Security and validation

- [security](security.md)
- [testing](testing.md)

## Historical results and reproduction

The reviewed source is [`e5c92255e978f36eee169390add6fdff5291fe2f`](https://github.com/JasonStys/mqtt-lifecycle-reliability-lab/tree/e5c92255e978f36eee169390add6fdff5291fe2f). The observed functional workflow baseline is `e5c92255e978f36eee169390add6fdff5291fe2f`; those observations are recorded at `2026-11-10T05:25:40.628667+00:00`. They do not certify an unrun later revision.

- [Detailed recorded validation](reports/recovery-2026-11-09.md)
- [Current Actions](https://github.com/JasonStys/mqtt-lifecycle-reliability-lab/actions) records later integration checks separately.
- Preserve dated measurements and follow the existing testing guide to reproduce them; a test-source inventory alone does not establish execution.

## Practical boundaries

- Trusted cleartext checkpoints use explicit persistence; no fsync/crash-atomic, distributed exactly-once or fencing guarantee is made.
- Copying a snapshot into separate fresh processes can replay messages more than once; callers must stop old publishers and use unique message IDs.
- Count-bounded batches can exceed the checkpoint byte cap; export fails instead of silently truncating.

## Maintaining these editions

Update the editable usage/design/test documents first. Rebuild and visually review every Word page and workbook tab before replacing an edition; verify the exact binary digests and evidence source in publications.json. Keep account data, logs with secrets, installed-app state and private test stores out of documentation. Source and release assets retain their existing security and licensing boundaries.
