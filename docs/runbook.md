# Operations Runbook

## Fast path

```bash
pnpm install --frozen-lockfile
pnpm verify
```

A healthy run reports all scenarios passed, coverage above thresholds, a successful dashboard build,
and benchmark throughput above 5,000 validated messages per second.

## Inspect generated evidence

- `artifacts/lab-report.json`: scenario timelines and final state.
- `artifacts/benchmark.json`: runtime, sample size, throughput, and gate.
- `coverage/coverage-summary.json`: machine-readable coverage totals.
- `dist/dashboard/`: production browser bundle.

Generated output is intentionally ignored by Git except for the dashboard's sample report. GitHub
Actions uploads a fresh evidence bundle for every run.

## Run the dashboard

```bash
pnpm scenario
pnpm exec vite --config vite.config.ts
```

Use the URL printed by Vite. If the page says it cannot load the report, rerun `pnpm scenario` and
confirm `dashboard/public/lab-report.json` exists.

## Optional Mosquitto broker

Docker is optional. If a Docker engine is running:

```bash
bash scripts/start-lab.sh
docker compose logs -f broker
docker compose down
```

The port is published only on `127.0.0.1:1883`. The profile permits anonymous clients solely to
remove credential bootstrapping from a local demo. Do not expose it to another interface or deploy
it. Use broker authentication, TLS, and broker-native ACLs for any shared environment.

## Common failures

### Lockfile policy failure

Do not bypass a supply-chain warning. Review the named package and version, update the explicit
allowlist only for a dependency that genuinely needs a build script, then regenerate the lockfile.
This repository currently allows only `esbuild`'s required install step.

### Coverage threshold failure

Open `coverage/index.html`, identify the uncovered decision path, and add a behavior-level test. Do
not lower thresholds to accommodate untested failure handling.

### Scenario failure

Open `artifacts/lab-report.json`, find the first failing timeline, then run the relevant unit test
before the integration suite. Scenario isolation means a prior scenario cannot mutate the failing
scenario's broker or state.

### Performance gate failure

Run `pnpm benchmark` three times on an otherwise idle machine. If the regression is repeatable,
profile schema parsing, JSON allocation, and metric merging. The benchmark is a guardrail, not a
capacity forecast for production hardware.

### Broker connection failure

Confirm Docker is running, `docker compose ps` shows the broker healthy, and port 1883 is unused.
The automated suite remains available even when Docker is unavailable.

## Release checklist

1. Run `pnpm verify` from a clean checkout.
2. Review dependency and CodeQL alerts.
3. Confirm the JSON Schema and executable schema still agree.
4. Review protocol changes for backward compatibility and update the ADR when needed.
5. Verify generated evidence contains no credentials or environment-specific secrets.
