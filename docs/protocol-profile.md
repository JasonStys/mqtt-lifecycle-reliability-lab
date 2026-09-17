# Lifecycle Protocol Profile

## Compatibility statement

This repository implements an original JSON profile in the `reliability/v1` namespace. It is
informed by common birth/death/state patterns but is **not Sparkplug wire-compatible** and must not
publish under a Sparkplug namespace. Sparkplug compatibility would require the standard topic
grammar, protobuf payload, metric alias rules, state handling, and formal conformance work.

## Topic grammar

```text
reliability/v1/{groupId}/nodes/{nodeId}/events/{event}
```

`event` is one of `birth`, `data`, `death`, or `state`. Identifiers are lowercase ASCII letters,
digits, and internal hyphens. Publisher topics never accept `+` or `#`. A group consumer may request
exactly:

```text
reliability/v1/{groupId}/nodes/+/events/+
```

## Envelope fields

| Field               | Meaning                           | Constraint                                   |
| ------------------- | --------------------------------- | -------------------------------------------- |
| `schemaVersion`     | Contract version                  | Literal `1.0`                                |
| `messageId`         | Application-level dedupe identity | UUID                                         |
| `groupId`, `nodeId` | Stable routing identity           | Canonical identifiers matching the topic     |
| `event`             | Lifecycle meaning                 | Birth, data, death, or state                 |
| `online`            | Current availability truth        | Birth/data must be true; death must be false |
| `birthSequence`     | Session generation                | Unsigned 32-bit integer                      |
| `seq`               | Delivery order within a birth     | Unsigned 8-bit integer; birth resets to zero |
| `sourceTimestamp`   | Time assigned at the node         | Offset-aware ISO 8601                        |
| `metrics`           | Typed values and metadata         | At most 256 metrics                          |
| `reason`            | Human-readable transition reason  | Required for death; maximum 160 characters   |

Each metric carries a name, declared datatype, typed value, quality, source timestamp, and optional
unit. JavaScript numbers marked `int64` are restricted to safe integers; exact 64-bit values outside
that range should use a future string or binary encoding instead of silently losing precision.

## Ordering rules

`seq` uses modulo-256 serial-number arithmetic:

- distance 0: duplicate sequence;
- distance 1: expected next value, including `255 → 0`;
- distance 2–127: forward gap;
- distance 128–255: delayed/out-of-order value.

Message-ID deduplication happens before sequence analysis. Retained `state` and `death` do not
advance telemetry ordering. A new `birthSequence` establishes a fresh sequence domain.

## Retained and will behavior

- Birth and data are non-retained event records.
- State is retained and replaces the previous current-state snapshot.
- The will is a retained state envelope with `online: false`.
- Reconnect replaces the offline retained state only after a new birth is published.
- A late subscriber therefore receives one current truth rather than replaying an unbounded history.

MQTT retained messages are independent from session state. Session expiry cannot be used as a
substitute for explicit application lifecycle state.

## Backpressure policy

The edge outbox stores metric batches and must be configured with a finite capacity. `drop-oldest`
preserves the newest process view; `reject-newest` protects already queued history. Both policies
record high-water mark and loss counters. The correct production choice depends on whether current
state or complete event history has higher operational value.

## Schema ownership

The executable Zod schema in `src/core/contracts.ts` is the runtime authority. The matching JSON
Schema in `schemas/lifecycle-envelope.schema.json` supports other languages and review tooling. A
contract change requires tests, schema updates, and a versioning decision.
