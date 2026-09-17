# Source Code Map

These anchors correspond to the initial validated release. Source headers describe each file and its
key data; this map centralizes line numbers so they are not duplicated across comments and allowed
to drift independently. GitHub's line links should always be checked after code changes.

## Core

| File                         | Symbol                    | Line | Purpose                                               |
| ---------------------------- | ------------------------- | ---: | ----------------------------------------------------- |
| `src/core/contracts.ts`      | `metricSchema`            |   17 | Validates typed metric metadata and values.           |
| `src/core/contracts.ts`      | `lifecycleEnvelopeSchema` |   57 | Validates the complete versioned envelope.            |
| `src/core/contracts.ts`      | `parseEnvelope`           |  119 | Safely parses bytes/text without boundary exceptions. |
| `src/core/topic.ts`          | `TOPIC_ROOT`              |    8 | Owns the original namespace root.                     |
| `src/core/topic.ts`          | `buildLifecycleTopic`     |   20 | Builds a validated publisher topic.                   |
| `src/core/topic.ts`          | `parseLifecycleTopic`     |   27 | Parses a canonical concrete topic.                    |
| `src/core/topic.ts`          | `buildGroupSubscription`  |   60 | Produces the only allowed group consumer filter.      |
| `src/core/sequence.ts`       | `assessSequence`          |   24 | Applies modulo-256 serial arithmetic.                 |
| `src/core/bounded-outbox.ts` | `BoundedOutbox`           |   19 | Owns capacity, FIFO items, and overflow counters.     |
| `src/core/bounded-outbox.ts` | `enqueue`                 |   41 | Accepts, drops, or rejects one item.                  |
| `src/core/authorization.ts`  | `AuthorizationPolicy`     |   20 | Owns fail-closed topic decisions.                     |
| `src/core/authorization.ts`  | `authorizePublish`        |   21 | Binds node writes to node identity.                   |
| `src/core/authorization.ts`  | `authorizeSubscribe`      |   38 | Binds consumer reads to one group.                    |
| `src/core/state-store.ts`    | `StateStore`              |   46 | Owns node state, bounded dedupe, and counters.        |
| `src/core/state-store.ts`    | `ingest`                  |   68 | Validates and applies one broker delivery.            |
| `src/core/state-store.ts`    | `getNode`                 |  142 | Returns one defensive state copy.                     |
| `src/core/state-store.ts`    | `snapshot`                |  147 | Returns deterministic sorted state.                   |
| `src/core/state-store.ts`    | `statistics`              |  155 | Exposes anomaly and acceptance counters.              |

## Lab and scenarios

| File                          | Symbol                         | Line | Purpose                                                        |
| ----------------------------- | ------------------------------ | ---: | -------------------------------------------------------------- |
| `src/lab/determinism.ts`      | `createDeterministicClock`     |   10 | Produces fixed-step simulated time.                            |
| `src/lab/determinism.ts`      | `createDeterministicIdFactory` |   24 | Produces stable UUID-shaped message IDs.                       |
| `src/lab/edge-node.ts`        | `EdgeNode`                     |   35 | Owns lifecycle, metrics, connection, and outbox state.         |
| `src/lab/edge-node.ts`        | `connect`                      |   61 | Publishes birth/state and flushes after reconnect.             |
| `src/lab/edge-node.ts`        | `publishMetrics`               |   90 | Selects immediate publish or bounded queue.                    |
| `src/lab/edge-node.ts`        | `disconnectGracefully`         |  101 | Publishes death/offline state and closes cleanly.              |
| `src/lab/edge-node.ts`        | `disconnectUnexpectedly`       |  113 | Lets the broker publish the registered will.                   |
| `src/lab/in-memory-broker.ts` | `BrokerConnection`             |   56 | Restricts client operations to an open session.                |
| `src/lab/in-memory-broker.ts` | `InMemoryBroker`               |  100 | Owns credentials, sessions, retained state, and subscriptions. |
| `src/lab/in-memory-broker.ts` | `connect`                      |  115 | Authenticates and creates a client session.                    |
| `src/lab/in-memory-broker.ts` | `restart`                      |  135 | Ends sessions and optionally preserves retained data.          |
| `src/lab/in-memory-broker.ts` | `replay`                       |  154 | Injects deterministic duplicate delivery.                      |
| `src/lab/in-memory-broker.ts` | `publishFrom`                  |  162 | Applies publish ACL, retention, logging, and delivery.         |
| `src/lab/in-memory-broker.ts` | `subscribeFrom`                |  185 | Applies subscribe ACL and retained bootstrap.                  |
| `src/lab/state-consumer.ts`   | `StateConsumer`                |   20 | Owns group observations and reconstructed store.               |
| `src/lab/state-consumer.ts`   | `connect`                      |   49 | Authenticates, subscribes, and ingests deliveries.             |
| `src/lab/scenario-suite.ts`   | `runScenarioSuite`             |   31 | Runs six isolated campaigns and aggregates evidence.           |

## External and reporting boundaries

| File                            | Symbol                   | Line | Purpose                                        |
| ------------------------------- | ------------------------ | ---: | ---------------------------------------------- |
| `src/mqtt/config.ts`            | `loadMqttConfiguration`  |   33 | Validates environment values at startup.       |
| `src/mqtt/config.ts`            | `publicConfiguration`    |   49 | Creates a diagnostic view without a password.  |
| `src/mqtt/mqtt-publisher.ts`    | `MqttLifecyclePublisher` |   20 | Owns the external MQTT.js client.              |
| `src/mqtt/mqtt-publisher.ts`    | `connect`                |   25 | Establishes an MQTT 5 persistent session.      |
| `src/mqtt/mqtt-publisher.ts`    | `publish`                |   51 | Validates and publishes one QoS 1 envelope.    |
| `src/mqtt/mqtt-publisher.ts`    | `disconnect`             |   65 | Ends the client session.                       |
| `src/reporting/report-model.ts` | `TimelineEntry`          |    9 | One ordered causal observation.                |
| `src/reporting/report-model.ts` | `ScenarioResult`         |   16 | One scenario's purpose, outcome, and evidence. |
| `src/reporting/report-model.ts` | `LabReport`              |   25 | Stable CLI/dashboard report boundary.          |
