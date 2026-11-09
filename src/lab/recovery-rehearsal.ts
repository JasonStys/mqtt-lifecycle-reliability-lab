/**
 * @file Fictional cold-chain telemetry recovery rehearsal; source anchors: docs/code-map.md.
 * @description Restarts a disconnected publisher with TTL expiry and smaller capacity, using real lab components.
 * @exports prepareRecoveryRehearsal; its checkpoint persistence callback enables actual file round trips.
 * @data clock is explicit simulated wall time; reports contain measurements and counts, never credentials.
 */
import { EdgeNode } from './edge-node.ts';
import { InMemoryBroker } from './in-memory-broker.ts';
import { StateConsumer } from './state-consumer.ts';
import { createDeterministicIdFactory } from './determinism.ts';
import type { Metric } from '../core/contracts.ts';

/** Creates a checkpoint and a fresh-process recovery step; the original publisher is never reconnected. */
export function prepareRecoveryRehearsal() {
  const broker = new InMemoryBroker();
  broker.registerCredential('fixture-node', 'fixture-only', {
    role: 'node',
    groupId: 'cold-chain',
    nodeId: 'van-07',
  });
  broker.registerCredential('fixture-consumer', 'fixture-only', {
    role: 'consumer',
    groupId: 'cold-chain',
  });
  let now = Date.parse('2026-01-15T12:00:00.000Z');
  const clock = () => new Date(now);
  const config = {
    clientId: 'van-07',
    groupId: 'cold-chain',
    nodeId: 'van-07',
    outboxCapacity: 4,
    outboxTtlMs: 1_000,
    overflowPolicy: 'drop-oldest' as const,
    username: 'fixture-node',
    password: 'fixture-only',
  };
  const original = new EdgeNode(broker, config, clock, createDeterministicIdFactory());
  const consumer = new StateConsumer({
    broker,
    clientId: 'cold-monitor',
    clock,
    groupId: 'cold-chain',
    username: 'fixture-consumer',
    password: 'fixture-only',
  });
  consumer.connect();
  original.connect();
  original.disconnectGracefully();
  const readings: Metric[] = [];
  for (const [offset, value] of [
    [0, 4.1],
    [700, 4.2],
    [800, 4.3],
    [900, 4.4],
  ] as const) {
    now = Date.parse('2026-01-15T12:00:00.000Z') + offset;
    const metric: Metric = {
      name: 'cargo.temperature',
      dataType: 'float64',
      value,
      unit: 'celsius',
      quality: 'good',
      sourceTimestamp: clock().toISOString(),
    };
    readings.push(metric);
    original.publishMetrics([metric]);
  }
  const checkpoint = original.checkpoint();
  /** Imports bytes read by the caller, then verifies the independent consumer's recovered state. */
  const recover = (serialized: string) => {
    now = Date.parse('2026-01-15T12:00:01.100Z');
    const recovered = new EdgeNode(
      broker,
      { ...config, outboxCapacity: 2 },
      clock,
      createDeterministicIdFactory(10_000),
    );
    const restore = recovered.restoreCheckpoint(serialized);
    recovered.connect();
    const state = consumer.store().getNode('cold-chain', 'van-07');
    const data = broker.publicationLog().filter((item) => item.topic.endsWith('/events/data'));
    const replayed = data.map(
      (item) =>
        JSON.parse(item.payload) as { seq: number; birthSequence: number; metrics: Metric[] },
    );
    const passed =
      restore.expired === 1 &&
      restore.capacityDropped === 1 &&
      restore.restored === 2 &&
      state?.metrics['cargo.temperature']?.value === 4.4 &&
      state.birthSequence === 2 &&
      recovered.statistics().outbox.replayed === 2 &&
      replayed.every(
        (item, index) =>
          item.birthSequence === 2 &&
          item.seq === index + 1 &&
          item.metrics[0]?.sourceTimestamp === readings[index + 2]?.sourceTimestamp,
      );
    recovered.disconnectGracefully();
    consumer.disconnect();
    return {
      passed,
      restore,
      replayed,
      statistics: recovered.statistics(),
      finalValue: state?.metrics['cargo.temperature']?.value,
    };
  };
  return { checkpoint, recover };
}
