# MQTT Lifecycle Reliability Lab

[![CI](https://github.com/JasonStys/mqtt-lifecycle-reliability-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/JasonStys/mqtt-lifecycle-reliability-lab/actions/workflows/ci.yml)
[![CodeQL](https://github.com/JasonStys/mqtt-lifecycle-reliability-lab/actions/workflows/codeql.yml/badge.svg)](https://github.com/JasonStys/mqtt-lifecycle-reliability-lab/actions/workflows/codeql.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A deterministic laboratory for the failure modes that make MQTT edge systems difficult: ambiguous
online state, QoS redelivery, delayed packets, offline backlog growth, broker restarts, and overly
broad topic permissions.

The project uses an original JSON lifecycle profile under `reliability/v1`. It borrows the useful
ideas of birth/death state, sequence tracking, and retained truth from industrial MQTT practice, but
it is deliberately **not Sparkplug wire-compatible**. That boundary is documented so the lab never
claims interoperability it does not provide.

## What this repository demonstrates

- MQTT 5 client configuration through a narrow MQTT.js adapter.
- Runtime validation of untrusted payloads with strict schemas.
- Retained current-state bootstrap for late subscribers.
- Last-will offline state, reconnect, and birth-sequence recovery.
- Message-ID deduplication plus unsigned 8-bit sequence analysis.
- Bounded offline buffering with measurable `drop-oldest` and `reject-newest` policies.
- Deny-by-default node publish and group subscription authorization.
- Deterministic fault injection and machine-readable scenario timelines.
- A responsive, framework-free dashboard that renders generated evidence safely.
- CI on Node.js 22 and 24, coverage gates, a performance floor, CodeQL, and dependency updates.

## Quick start

Requirements: Node.js 22 or 24 and pnpm 11.

```bash
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` formats-checks, type-checks, lints, runs unit and integration tests, builds the
dashboard, generates the fault report, and runs the ingestion benchmark. The report is written to
`artifacts/lab-report.json` and copied to `dashboard/public/lab-report.json`.

To inspect the dashboard locally:

```bash
pnpm scenario
pnpm exec vite --config vite.config.ts
```

Then open the address printed by Vite. The test suite does not require Docker or a network service.

## Reliability campaign

| Scenario                 | Failure injected                                   | Pass condition                                                         |
| ------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------- |
| Late consumer bootstrap  | Consumer subscribes after telemetry                | Retained state restores identity, value, and online status             |
| Will and rebirth         | Edge session disappears                            | Offline will is applied; next birth increments `birthSequence`         |
| Duplicate and ordering   | QoS-style retry plus delayed packet                | Duplicate work is suppressed; old data cannot roll state backward      |
| Bounded offline buffer   | Five updates enter capacity three                  | Two drops are counted; three surviving updates flush in FIFO order     |
| Authorization boundaries | Bad secret and cross-namespace requests            | Authentication and both ACL violations are denied                      |
| Broker restart           | Sessions disappear while retained storage persists | Late consumer sees offline truth; rebirth restores the metric snapshot |

Current checked validation evidence: **6/6 scenarios**, **24/24 unit tests**, **1/1 integration
test**, and **94.94% line coverage**. See [the validation report](docs/reports/validation-report.md)
for the environment and exact commands.

## Architecture

```text
EdgeNode ── lifecycle envelopes ──► Broker boundary ── deliveries ──► StateConsumer
   │                                     │                                │
   ├─ bounded offline queue              ├─ credentials + ACL             ├─ schema validation
   ├─ birth/death/state                  ├─ retained state                ├─ dedupe + ordering
   └─ source timestamps                  └─ last-will + restart           └─ current node state
                                                                               │
Scenario suite ───────── fault injection + assertions ──────────────────────────┤
                                                                               ▼
                                                                  JSON report + dashboard
```

Production-facing MQTT code depends on the same contracts and topic builder, while deterministic
tests substitute the broker boundary. This keeps fault tests fast without hiding the external
adapter behind application logic.

## Major components and complexity

| Component                | Primary responsibility                                      | Time / space behavior                                      |
| ------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------- |
| `StateStore.ingest`      | Validate, deduplicate, classify, and merge one delivery     | O(m) time for `m` metrics; O(n × m) state across `n` nodes |
| `assessSequence`         | Classify next, gap, duplicate, or late sequence across wrap | O(1) time and space                                        |
| `BoundedOutbox.enqueue`  | Apply explicit overflow policy                              | O(1) amortized enqueue; capacity-bounded space             |
| `AuthorizationPolicy`    | Enforce node ownership and group read scope                 | O(t) in topic length; O(1) auxiliary space                 |
| `InMemoryBroker`         | Model retained messages, subscriptions, wills, and restart  | O(s) delivery for `s` subscriptions                        |
| `runScenarioSuite`       | Execute isolated failure campaigns and aggregate evidence   | O(events + deliveries)                                     |
| `MqttLifecyclePublisher` | Configure MQTT 5 and publish validated QoS 1 envelopes      | Network-bound; hidden QoS 0 queuing disabled               |

## Repository map

```text
src/core/          Protocol contracts, topics, sequence logic, state, authorization, outbox
src/lab/           Deterministic broker, edge node, consumer, and fault scenarios
src/mqtt/          Environment validation and real MQTT.js publishing adapter
src/reporting/     Stable report types shared with the dashboard
dashboard/         Accessible evidence viewer built with plain TypeScript and CSS
tests/             Unit and end-to-end lifecycle integration tests
schemas/           Language-neutral JSON Schema for the lifecycle envelope
infra/mosquitto/   Optional loopback-only Mosquitto development profile
docs/              Architecture, protocol, testing, operations, decisions, and reports
.github/           CI, CodeQL, Dependabot, and contribution templates
```

Every tracked file is summarized in [the file catalog](docs/file-catalog.md). Key symbols and their
current line anchors are listed in [the code map](docs/code-map.md).

## Design boundaries

- The deterministic broker models the semantics needed by the fault suite; it is not a complete
  MQTT implementation or a broker conformance test.
- The optional Mosquitto profile is bound to loopback and allows anonymous access for local
  exploration. It is intentionally unsuitable for deployment.
- The JSON lifecycle profile is original and human-readable. Real Sparkplug compatibility would
  require its exact topic namespace, protobuf payload, state rules, and conformance testing.
- Timestamps preserve both device source time and consumer receive time. The store warns at five
  minutes of skew but does not rewrite source time.

## Documentation

- [Architecture](docs/architecture.md)
- [Protocol profile](docs/protocol-profile.md)
- [Testing strategy](docs/testing.md)
- [Operations runbook](docs/runbook.md)
- [Security model](docs/security.md)
- [Reliability findings](docs/reports/reliability-findings.md)
- [Validation report](docs/reports/validation-report.md)
- [References](docs/references.md)

## License

Released under the [MIT License](LICENSE).
