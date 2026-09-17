# Security Model

## Assets and trust boundaries

The system protects node identity, telemetry integrity, current online state, broker credentials, and
availability under backlog. MQTT topics and payloads are untrusted at the consumer boundary. Process
environment variables are untrusted at configuration load. The browser report is data, not markup.

## Controls

- Strict runtime validation rejects unknown fields and type/identity mismatches.
- Publish authorization binds a node principal to one group/node namespace.
- Subscribe authorization allows only the exact consumer group filter.
- Every unrecognized role, path, or operation is denied.
- Offline queues and dedupe memory are explicitly bounded.
- Public configuration output contains an authentication-present flag, never a password.
- Dashboard text uses DOM `textContent` instead of HTML injection.
- CI has read-only contents permission except CodeQL's required security-event write.
- Third-party GitHub Actions use immutable commit SHAs.
- The only approved package install script is `esbuild`, declared in `pnpm-workspace.yaml`.

## Deliberate local-only exceptions

The deterministic broker stores lab credentials as plain strings because it exists only in one test
process. The optional Mosquitto profile permits anonymous access but binds the host port to loopback.
Neither mechanism is a deployment pattern.

For a shared environment, require TLS, broker-native password or federated authentication,
least-privilege broker ACLs, protected secret injection, connection quotas, message-size limits,
certificate rotation, audit logs, and an incident-tested revocation path.

## Abuse cases

| Abuse case                   | Response                                                 |
| ---------------------------- | -------------------------------------------------------- |
| Cross-node topic write       | Denied before retained state can change                  |
| Cross-group wildcard read    | Denied by exact filter comparison                        |
| Oversized metric collection  | Schema caps one envelope at 256 metrics                  |
| Unbounded offline production | Queue stops at configured capacity and counts loss       |
| Duplicate QoS replay         | Message-ID window suppresses state mutation              |
| Delayed valid message        | Sequence is recorded; current state is not rolled back   |
| Future/past device clock     | Source and receive time remain separate; skew is counted |
| Report text contains markup  | Rendered as text, not executable HTML                    |

## Reporting a vulnerability

Use the repository's private GitHub security-advisory workflow. Do not open a public issue containing
credentials, exploit details, or sensitive deployment information. See the root `SECURITY.md` for the
supported-version policy.
