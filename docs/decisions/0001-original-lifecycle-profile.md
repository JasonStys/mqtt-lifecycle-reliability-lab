# ADR 0001: Use an original JSON lifecycle profile

- Status: Accepted
- Date: 2026-09-16

## Context

The lab needs readable messages for failure analysis while demonstrating birth/death state,
retained truth, sequence behavior, typed metrics, and broker reconnects. Using a standard namespace
without its exact payload and conformance rules would create a misleading compatibility claim.

## Decision

Use a versioned, original namespace (`reliability/v1`) and strict JSON envelope. Keep the profile
informed by publicly documented industrial MQTT patterns, explicitly state that it is not Sparkplug
wire-compatible, and provide both executable and language-neutral schemas.

## Consequences

### Positive

- Messages are readable in test reports and broker tools.
- Runtime validation and JSON Schema remain straightforward.
- The project can focus on reliability decisions rather than protobuf generation.
- The compatibility boundary is honest and reviewable.

### Negative

- The lab cannot interoperate directly with standard Sparkplug hosts or edge nodes.
- JSON uses more bandwidth than a compact binary payload.
- JavaScript cannot represent every 64-bit integer exactly; the profile restricts `int64` to safe
  integers until a versioned representation is added.

## Revisit when

A concrete interoperability requirement justifies adopting the complete standard, payload tooling,
broker integration suite, and conformance tests.
