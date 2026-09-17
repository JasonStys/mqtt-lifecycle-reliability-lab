# File Catalog

This catalog gives every tracked file a single responsibility. Generated directories (`artifacts`,
`coverage`, `dist`, and `node_modules`) are intentionally excluded.

## Root and toolchain

| File                           | Responsibility                                                             |
| ------------------------------ | -------------------------------------------------------------------------- |
| `.editorconfig`                | Cross-editor whitespace, encoding, and newline rules.                      |
| `.env.example`                 | Documented nonsecret MQTT environment keys.                                |
| `.gitignore`                   | Keeps dependencies, secrets, logs, and generated evidence out of Git.      |
| `.prettierignore`              | Excludes generated/lock content from formatting.                           |
| `.prettierrc.json`             | Repository formatting policy.                                              |
| `compose.yaml`                 | Optional loopback-only Mosquitto service and health check.                 |
| `eslint.config.js`             | Type-aware ESLint flat configuration and zero-warning policy.              |
| `LICENSE`                      | MIT license and copyright.                                                 |
| `package.json`                 | Pinned dependencies, runtime requirements, and verification commands.      |
| `pnpm-lock.yaml`               | Reproducible dependency graph with integrity data.                         |
| `pnpm-workspace.yaml`          | Supply-chain build-script allowlist for `esbuild`.                         |
| `README.md`                    | Project purpose, quickstart, features, architecture, and evidence summary. |
| `tsconfig.json`                | Strict TypeScript 6 compiler configuration.                                |
| `vite.config.ts`               | Production dashboard bundle configuration.                                 |
| `vitest.config.ts`             | Unit test discovery and coverage gates.                                    |
| `vitest.integration.config.ts` | Full lifecycle campaign test configuration.                                |

## Source

| File                            | Responsibility                                                                |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `src/benchmark.ts`              | Measures validated state-ingestion throughput and writes a gated JSON report. |
| `src/cli.ts`                    | Runs the scenario campaign and writes artifact/dashboard JSON.                |
| `src/core/authorization.ts`     | Deny-by-default publish and subscribe policy.                                 |
| `src/core/bounded-outbox.ts`    | Capacity-bounded FIFO with explicit overflow accounting.                      |
| `src/core/contracts.ts`         | Runtime schemas, TypeScript types, and safe JSON parsing.                     |
| `src/core/sequence.ts`          | Modulo-256 serial-number classification.                                      |
| `src/core/state-store.ts`       | Validated state reconstruction, anomaly counters, and bounded dedupe.         |
| `src/core/topic.ts`             | Original namespace construction, parsing, and group filter generation.        |
| `src/lab/determinism.ts`        | Fixed-step clock and deterministic UUID factory.                              |
| `src/lab/edge-node.ts`          | Birth/data/death/state publisher with bounded offline buffering.              |
| `src/lab/in-memory-broker.ts`   | Deterministic authentication, ACL, retained, will, replay, and restart model. |
| `src/lab/scenario-suite.ts`     | Six isolated reliability and security fault campaigns.                        |
| `src/lab/state-consumer.ts`     | Group subscription, state-store ingestion, and observation capture.           |
| `src/mqtt/config.ts`            | Environment validation and secret-safe diagnostics.                           |
| `src/mqtt/mqtt-publisher.ts`    | MQTT.js v5 QoS 1 publisher boundary.                                          |
| `src/reporting/report-model.ts` | Stable report types shared by CLI and dashboard.                              |

## Dashboard and schema

| File                                     | Responsibility                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `dashboard/app.ts`                       | Safe DOM rendering for status, summaries, timelines, and observations. |
| `dashboard/index.html`                   | Semantic page shell, skip link, metadata, and live regions.            |
| `dashboard/public/lab-report.json`       | Checked sample generated from the deterministic campaign.              |
| `dashboard/styles.css`                   | Responsive, high-contrast dashboard visual system.                     |
| `schemas/lifecycle-envelope.schema.json` | Portable Draft 2020-12 lifecycle envelope contract.                    |

## Tests

| File                                              | Responsibility                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `tests/integration/lifecycle.integration.test.ts` | End-to-end node/broker/consumer/report campaign assertion.           |
| `tests/unit/bounded-outbox.test.ts`               | Capacity, FIFO, drop-oldest, and reject-newest behavior.             |
| `tests/unit/contracts-topic.test.ts`              | Payload validation and canonical topic boundaries.                   |
| `tests/unit/fixtures.ts`                          | Valid, deterministic message and metric builders.                    |
| `tests/unit/scenario-config.test.ts`              | Full scenario summary, deterministic helpers, and config redaction.  |
| `tests/unit/sequence-authorization.test.ts`       | Sequence wrap/anomalies and least-privilege ACL decisions.           |
| `tests/unit/state-store.test.ts`                  | Rejection, dedupe, ordering, skew, merge, and memory-bound behavior. |

## Automation and infrastructure

| File                             | Responsibility                                                         |
| -------------------------------- | ---------------------------------------------------------------------- |
| `.github/dependabot.yml`         | Weekly npm, Actions, and Docker update groups.                         |
| `.github/workflows/ci.yml`       | Node 22/24 quality, scenario, build, benchmark, and artifact pipeline. |
| `.github/workflows/codeql.yml`   | JavaScript/TypeScript security analysis.                               |
| `infra/mosquitto/mosquitto.conf` | Local broker persistence and resource limits.                          |
| `scripts/clean.mjs`              | Cross-platform removal of repository-generated output only.            |
| `scripts/start-lab.sh`           | Bash prerequisite check and optional broker startup.                   |

## Documentation and governance

| File                                                | Responsibility                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `CONTRIBUTING.md`                                   | Change, test, protocol, and secret-handling expectations.                    |
| `SECURITY.md`                                       | Supported-version and private-reporting policy.                              |
| `docs/architecture.md`                              | Components, state flow, failure containment, and trade-offs.                 |
| `docs/code-map.md`                                  | Commit-specific source symbol line anchors.                                  |
| `docs/decisions/0001-original-lifecycle-profile.md` | Decision record for the nonstandard JSON profile.                            |
| `docs/file-catalog.md`                              | This complete tracked-file responsibility map.                               |
| `docs/protocol-profile.md`                          | Namespace, envelope, ordering, retained, and backpressure rules.             |
| `docs/references.md`                                | Primary standards and implementation sources.                                |
| `docs/reports/reliability-findings.md`              | Interpreted results from each failure campaign.                              |
| `docs/reports/validation-report.md`                 | Exact local commands, versions, coverage, and measured performance.          |
| `docs/runbook.md`                                   | Build, evidence, dashboard, broker, troubleshooting, and release procedures. |
| `docs/security.md`                                  | Assets, trust boundaries, controls, abuse cases, and deployment gaps.        |
| `docs/testing.md`                                   | Risk-based test pyramid, commands, CI behavior, and explicit limitations.    |
