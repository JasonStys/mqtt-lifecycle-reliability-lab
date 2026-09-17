# Contributing

1. Open an issue that describes the reliability behavior or defect.
2. Keep protocol changes backward-compatible or add an ADR and version change.
3. Add behavior-level tests for normal, boundary, and failure paths.
4. Run `pnpm verify` before opening a pull request.
5. Update the executable schema, JSON Schema, documentation, and sample report together.

Commits should be focused and explain why the change is needed. Never add real broker credentials,
private endpoints, production telemetry, generated coverage output, or unbounded queues.
