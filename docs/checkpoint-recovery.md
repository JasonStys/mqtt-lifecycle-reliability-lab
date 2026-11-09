# Checkpoint and recovery workflow

A reliability engineer can rehearse process replacement after an offline interval without sending
stale measurements as fresh readings. `EdgeNode.checkpoint()` exports disconnected-node state;
`restoreCheckpoint(serialized)` imports it into a never-connected, empty replacement node with the
same group/node identity. Connect that replacement to publish a new birth and replay live batches.
The old process must remain stopped. Credentials are supplied separately through configuration.

## Walkthrough

Run `pnpm recovery`. The command writes a unique ignored directory under `artifacts/`, saves a
checkpoint with exclusive creation, reads it back, restores a smaller queue, connects the new node
through the deterministic broker, and verifies the independent consumer. Its fictional cold-chain
van records 4.1, 4.2, 4.3 and 4.4 Celsius at 0, 700, 800 and 900 ms. With a 1,000 ms TTL and recovery
at 1,100 ms, 4.1 expires; a receiving capacity of two with drop-oldest discards 4.2; 4.3 and 4.4 replay.
They keep their 800/900 ms source times and receive birth 2 and sequence 1/2. The final consumer value
must be 4.4. The generated dashboard shows the same scenario, counts, and causal timeline.

For application code, disconnect the node, save `node.checkpoint()` bytes to your protected store,
construct a fresh node with matching identity and new, globally unique wire IDs, call
`restoreCheckpoint(bytes)`, inspect its `{ restored, expired, capacityDropped }`, then `connect()`.
Use `retryBuffered()` on an active connection after a synchronous publication throws. The queue
retains the failed batch; successful earlier batches remain removed. A partially successful
publication can repeat on retry. Consumers must remain idempotent.

## Invariants and limits

- The strict `outbox-1` schema rejects unknown fields, identities, versions, duplicate/out-of-order
  ordinals, invalid measurement types, future enqueue times, impossible lifetimes, and duplicate
  current-state metric names. JSON input is capped at 1 MiB before parsing. A malformed, wrong-node,
  future or reused checkpoint cannot partially replace an existing queue.
- Capacity is 1..1,000 batches, each with 1..256 metrics. A metric string is capped at 512 characters.
  TTL is 1..86,400,000 ms, default one day. Expiry is inclusive: `expiresAt <= now` is expired. The
  caller's wall clock must be a nonnegative safe millisecond time and may not regress. Restore never
  extends a saved expiry even when the receiving TTL is longer. Snapshot creation purges expiry too.
- Receiving capacity/policy governs capacity shrink: drop-oldest keeps the newest live batches;
  reject-newest keeps the oldest. Both return exact dropped counts; the existing policy counters
  record the same decisions. Valid saved ordinals continue monotonically; exhaustion fails closed.
- Restoration is allowed once per pristine queue, including an empty restored queue. Previously used
  local queues and ever-connected nodes cannot import a snapshot. Copying one snapshot into multiple
  fresh processes is still possible: this is an at-least-once rehearsal, not distributed fencing or
  an exactly-once broker acknowledgment protocol. Stop the previous publisher yourself.
- Node birth counters do not silently wrap. Checkpoints must leave room for the next birth. Once
  the uint32 counter is exhausted, establish a separately provisioned identity. Sequence numbers
  retain the original modulo-256 rules, tested through wrap on recovered telemetry.
- Checkpoints contain measurement data/current state and identity, no password/configuration or
  executable wire envelope. They are neither encrypted nor signed. Anyone with file access can read
  or alter valid data. Use trusted storage/ACLs, encryption and authenticated persistence in a real
  deployment. `0600` is requested where supported; Windows protection follows its directory ACL.
- Persistence is explicit. The example creates a new file and does not overwrite any prior file; it
  does not claim crash-atomic/fsync durability, automatic background saves, MQTT broker conformance,
  external MQTT-adapter persistence, distributed failover, or Sparkplug wire compatibility. A large
  in-memory queue/current-state snapshot may exceed the export byte cap and is rejected rather than
  truncated. Use smaller batches/capacity and appropriate protected persistence in a real service.

## Evidence

Independent handwritten checkpoint tests cover both shrink policies, exact expiry boundaries,
mutated input/output copies, clock regression, malformed/oversized/future input, duplicate restores,
node identity, counters, invalid metrics and non-wrapping births. A forced broker publication failure
proves the batch survives until explicit retry. A 260-batch recovered queue tests actual consumer
sequence wrap; the file integration test reads actual saved bytes rather than passing an object
straight back to the implementation. Original ACL, anomaly, retained-state and throughput gates
remain in force. See [the validation report](reports/recovery-2026-11-09.md).
