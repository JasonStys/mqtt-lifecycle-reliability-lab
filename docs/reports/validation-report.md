# Validation Report

- Date: 2026-09-16 America/Los_Angeles
- Runtime: Node.js v24.18.1, pnpm 11.19.0
- Host: Windows development machine
- Network services: none required
- Docker integration: not run because the local Docker engine was unavailable

## Results

| Check                         | Result                                              |
| ----------------------------- | --------------------------------------------------- |
| Dependency peer compatibility | Pass; no peer issues after pinning TypeScript 6.0.3 |
| Strict TypeScript             | Pass                                                |
| Type-aware ESLint             | Pass; zero warnings allowed                         |
| Prettier check                | Pass                                                |
| Unit tests                    | 24 passed, 0 failed                                 |
| Integration tests             | 1 passed, 0 failed                                  |
| Reliability scenarios         | 6 passed, 0 failed                                  |
| Dashboard production build    | Pass; 5 modules transformed                         |
| Performance gate              | Pass; 20,000 validated messages in 195.944 ms       |

## Coverage

| Measure    | Covered | Gate |
| ---------- | ------: | ---: |
| Statements |  94.80% |  90% |
| Branches   |  86.87% |  85% |
| Functions  |  96.77% |  90% |
| Lines      |  94.94% |  90% |

## Performance observation

The local run processed 102,070 validated messages per second against a 5,000 messages/second CI
floor. This microbenchmark measures JSON creation/parsing, runtime validation, dedupe, sequence
classification, and in-memory metric merge. It excludes network, broker, disk, TLS, and dashboard
costs, so it is a regression signal rather than a deployment capacity claim.

## Commands executed

```bash
pnpm peers check
pnpm typecheck
pnpm format:check
pnpm lint
pnpm test
pnpm test:integration
pnpm build
pnpm scenario
pnpm benchmark
```

## Residual validation gap

The optional Mosquitto container was not started on this host. The deterministic campaign validates
application lifecycle behavior, but it does not replace an authenticated TLS broker integration or
MQTT conformance suite. That limitation is stated in the README and testing strategy.
