# Reliability Findings

## Executive result

All six deterministic scenarios passed. The implementation reconstructed retained state for a late
subscriber, changed to offline on an ungraceful disconnect, recovered on a new birth, suppressed a
QoS-style duplicate, refused a delayed packet's state rollback, bounded offline memory, denied three
credential/namespace violations, and restored state after a persistent broker restart.

## Observations

### Retained state is the bootstrap contract

A consumer that starts after birth and data receives one retained state envelope containing current
identity, availability, metrics, datatypes, units, quality, source time, and birth/sequence context.
This avoids depending on event replay for current state.

### Duplicate identity and order solve different problems

An exact QoS retry reused the same message ID and was suppressed before state work. A distinct late
message reused an old sequence and was counted as out-of-order. Keeping both mechanisms prevents a
retry from inflating sequence anomalies and prevents a new-ID replay from rolling back state.

### Offline buffers need product policy, not a hidden default

Five disconnected updates entered a capacity-three queue. `drop-oldest` discarded exactly two,
reported a high-water mark of three, and delivered values 2, 3, and 4 after rebirth. The final
current value was 4. Loss was deliberate and measurable.

### Retained offline truth matters during restart

When sessions disappeared, the node will replaced its retained online snapshot with offline state.
A consumer reconnecting after restart immediately learned the node was offline. The subsequent node
birth replaced that snapshot and restored the previous metric value.

### ACLs should express identity ownership

The model denied a bad password, a valid node writing another node's topic, and a valid consumer
subscribing to another group. Role alone is insufficient; both role and concrete identity scope are
checked.

## Follow-on work

1. Add authenticated TLS Mosquitto integration in CI with ephemeral credentials.
2. Persist the edge outbox and dedupe window across process restarts.
3. Add message expiry and stale-state policy to retained snapshots.
4. Exercise a two-broker failover topology and duplicated session takeover.
5. If interoperability becomes a goal, implement the full standard separately and run its
   conformance suite rather than extending this namespace by implication.
