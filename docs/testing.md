# Testing Strategy

## Quality risks

| Risk                                    | Likelihood | Impact | Primary evidence                              |
| --------------------------------------- | ---------- | ------ | --------------------------------------------- |
| Malformed payload corrupts state        | Medium     | High   | Contract and state-store unit tests           |
| Duplicate QoS delivery repeats work     | High       | Medium | Duplicate replay scenario                     |
| Delayed packet rolls state backward     | Medium     | High   | Out-of-order scenario                         |
| Offline queue grows without bound       | Medium     | High   | Both queue-policy tests and overflow scenario |
| Online status survives a dead session   | Medium     | High   | Will/rebirth and broker-restart scenarios     |
| Topic permissions cross tenants/nodes   | Medium     | High   | Authorization unit and scenario tests         |
| Tooling drift breaks supported runtimes | Medium     | Medium | Node 22/24 CI matrix and frozen lockfile      |
| State processing regresses materially   | Low        | Medium | 20,000-message CI performance floor           |

## Test pyramid

### Unit layer

Fast Vitest cases cover contract refinement, malformed JSON, canonical topics, serial arithmetic,
ACL decisions, queue behavior, dedupe eviction, clock skew, state merge rules, deterministic helpers,
and environment redaction. Coverage gates are 90% statements/lines/functions and 85% branches for
the core and lab layers.

### Integration layer

The full campaign wires `EdgeNode → InMemoryBroker → StateConsumer → StateStore → LabReport`. It
asserts all six scenarios and the final state snapshot. This catches boundary and causal-order bugs
without a nondeterministic network dependency.

### External smoke layer

The optional Mosquitto Compose profile supports manual MQTT.js adapter exploration. It is not
required in CI because the current adapter is publisher-only and the deterministic suite provides
stronger, repeatable failure injection. A future end-to-end broker job should use nonanonymous
credentials and assert retained/will behavior against the selected broker version.

## Commands

```bash
pnpm test                 # unit tests plus coverage gates
pnpm test:integration     # complete lifecycle campaign
pnpm build                # strict type check and dashboard production build
pnpm scenario             # JSON fault evidence for CI and dashboard
pnpm benchmark            # ingestion performance evidence and floor
pnpm verify               # all required local checks
```

## CI behavior

CI installs from the frozen lockfile, runs the same checks on Node.js 22 and 24, and uploads the Node
24 report, coverage summary, benchmark, and dashboard bundle for 14 days. Workflows have minimum
permissions, immutable action pins, timeouts, and concurrency cancellation. CodeQL runs on pushes,
pull requests, a weekly schedule, and manual dispatch.

## What the tests do not prove

- MQTT packet-parser or broker conformance.
- Real WAN latency, packet corruption, TLS negotiation, or certificate rotation.
- Durable outbox behavior across edge-process power loss.
- Multi-process consistency or high-availability broker failover.
- Formal Sparkplug conformance.

These are explicit follow-on integration targets, not implicit claims.
