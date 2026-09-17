/**
 * @file Deterministic reliability scenario suite.
 * @description Exercises retained bootstrap, lifecycle recovery, anomalies, backpressure, and ACLs.
 * @exports runScenarioSuite.
 * @data each scenario owns an isolated harness so failures cannot contaminate later evidence.
 */
import type { Metric } from '../core/contracts.ts';
import { buildLifecycleTopic } from '../core/topic.ts';
import { createDeterministicClock, createDeterministicIdFactory } from './determinism.ts';
import { EdgeNode, type Clock, type IdFactory } from './edge-node.ts';
import { AuthenticationError, AuthorizationError, InMemoryBroker } from './in-memory-broker.ts';
import { StateConsumer } from './state-consumer.ts';
import type { LabReport, ScenarioResult, TimelineEntry } from '../reporting/report-model.ts';

const GROUP_ID = 'plant-a';
const NODE_ID = 'edge-01';
const NODE_PASSWORD = 'node-password';
const NODE_USERNAME = 'node-edge-01';
const CONSUMER_PASSWORD = 'consumer-password';
const CONSUMER_USERNAME = 'supervisor';

interface Harness {
  readonly broker: InMemoryBroker;
  readonly clock: Clock;
  readonly consumer: StateConsumer;
  readonly ids: IdFactory;
  readonly node: EdgeNode;
}

/** Runs every isolated fault scenario and aggregates machine-readable evidence. */
export function runScenarioSuite(generatedAt = new Date().toISOString()): LabReport {
  const scenarios = [
    retainedBootstrapScenario(),
    lifecycleRecoveryScenario(),
    duplicateAndOrderingScenario(),
    boundedOfflineBufferScenario(),
    authorizationScenario(),
    brokerRestartScenario(),
  ];
  const finalHarness = createHarness();
  finalHarness.consumer.connect();
  finalHarness.node.connect();
  finalHarness.node.publishMetrics([
    metric(finalHarness.clock, 'line.speed', 42, 'float64', 'rpm'),
  ]);

  const passed = scenarios.filter((scenario) => scenario.passed).length;
  return {
    generatedAt,
    profile: {
      compatibility: 'original-json-profile-not-sparkplug-wire-compatible',
      namespace: 'reliability/v1',
      transport: 'MQTT-5-semantics',
    },
    scenarios,
    snapshot: finalHarness.consumer.store().snapshot(),
    statistics: finalHarness.consumer.store().statistics(),
    summary: { failed: scenarios.length - passed, passed, total: scenarios.length },
  };
}

function retainedBootstrapScenario(): ScenarioResult {
  const harness = createHarness();
  harness.node.connect();
  harness.node.publishMetrics([
    metric(harness.clock, 'process.temperature', 73.5, 'float64', 'celsius'),
  ]);
  harness.consumer.connect();
  const state = harness.consumer.store().getNode(GROUP_ID, NODE_ID);
  const retained = harness.consumer.observations().some((observation) => observation.retained);
  const passed =
    retained && state?.online === true && state.metrics['process.temperature']?.value === 73.5;

  return scenario(
    'retained-bootstrap',
    'Late consumer state bootstrap',
    'Prove a late subscriber reconstructs current node state from one retained snapshot.',
    passed,
    [
      `retained delivery observed: ${String(retained)}`,
      `reconstructed temperature: ${String(state?.metrics['process.temperature']?.value)}`,
    ],
    [
      entry(0, 'publish', 'Node writes a retained current-state envelope.', 'info'),
      entry(1, 'subscribe', 'Consumer subscribes after the telemetry update.', 'info'),
      entry(
        2,
        'reconstruct',
        passed ? 'Current state reconstructed.' : 'Bootstrap failed.',
        passed ? 'success' : 'failure',
      ),
    ],
  );
}

function lifecycleRecoveryScenario(): ScenarioResult {
  const harness = createHarness();
  harness.consumer.connect();
  harness.node.connect();
  harness.node.disconnectUnexpectedly();
  const offline = harness.consumer.store().getNode(GROUP_ID, NODE_ID)?.online === false;
  harness.node.connect();
  const recoveredState = harness.consumer.store().getNode(GROUP_ID, NODE_ID);
  const passed = offline && recoveredState?.online === true && recoveredState.birthSequence === 2;

  return scenario(
    'lifecycle-recovery',
    'Will, reconnect, and rebirth',
    'Prove an ungraceful disconnect becomes offline state and a new birth restores trust.',
    passed,
    [
      `offline will applied: ${String(offline)}`,
      `recovery birth sequence: ${String(recoveredState?.birthSequence)}`,
    ],
    [
      entry(0, 'birth', 'Initial birth establishes birth sequence 1.', 'success'),
      entry(1, 'network-loss', 'Broker publishes the retained offline will.', 'warning'),
      entry(
        2,
        'rebirth',
        'Reconnect establishes birth sequence 2.',
        passed ? 'success' : 'failure',
      ),
    ],
  );
}

function duplicateAndOrderingScenario(): ScenarioResult {
  const harness = createHarness();
  harness.consumer.connect();
  harness.node.connect();
  harness.node.publishMetrics([metric(harness.clock, 'counter.parts', 1, 'int64', 'count')]);
  const firstDataIndex = harness.broker
    .publicationLog()
    .findIndex((publication) => publication.topic.endsWith('/events/data'));
  harness.broker.replay(firstDataIndex);
  harness.node.publishMetrics([metric(harness.clock, 'counter.parts', 2, 'int64', 'count')]);

  const firstData = harness.broker.publicationLog()[firstDataIndex];
  if (firstData === undefined) {
    throw new Error('scenario expected a data publication');
  }
  const lateEnvelope = JSON.parse(firstData.payload) as Record<string, unknown>;
  lateEnvelope.messageId = harness.ids();
  const injector = harness.broker.connect('fault-injector', NODE_USERNAME, NODE_PASSWORD);
  injector.publish(firstData.topic, JSON.stringify(lateEnvelope));
  injector.disconnect();

  const statistics = harness.consumer.store().statistics();
  const currentValue = harness.consumer.store().getNode(GROUP_ID, NODE_ID)?.metrics[
    'counter.parts'
  ]?.value;
  const passed =
    statistics.duplicateMessages === 1 && statistics.outOfOrder === 1 && currentValue === 2;

  return scenario(
    'duplicate-and-ordering',
    'QoS duplicate and delayed packet',
    'Prove message IDs suppress duplicate work and old sequences cannot roll state backward.',
    passed,
    [
      `duplicate messages: ${statistics.duplicateMessages}`,
      `out-of-order messages: ${statistics.outOfOrder}`,
      `current counter: ${String(currentValue)}`,
    ],
    [
      entry(0, 'data', 'Sequence 1 is accepted.', 'success'),
      entry(1, 'retry', 'Same message ID is redelivered and deduplicated.', 'warning'),
      entry(2, 'data', 'Sequence 2 advances current state.', 'success'),
      entry(
        3,
        'late-data',
        'Distinct message with sequence 1 is observed but not applied.',
        passed ? 'success' : 'failure',
      ),
    ],
  );
}

function boundedOfflineBufferScenario(): ScenarioResult {
  const harness = createHarness(3);
  harness.consumer.connect();
  harness.node.connect();
  harness.node.disconnectUnexpectedly();
  for (let value = 0; value < 5; value += 1) {
    harness.node.publishMetrics([metric(harness.clock, 'queue.value', value, 'int64', 'count')]);
  }
  const beforeReconnect = harness.node.statistics();
  harness.node.connect();
  const afterReconnect = harness.node.statistics();
  const finalValue = harness.consumer.store().getNode(GROUP_ID, NODE_ID)?.metrics[
    'queue.value'
  ]?.value;
  const passed =
    beforeReconnect.buffered === 3 &&
    beforeReconnect.outbox.droppedOldest === 2 &&
    afterReconnect.buffered === 0 &&
    finalValue === 4;

  return scenario(
    'bounded-offline-buffer',
    'Bounded offline buffering',
    'Prove memory is bounded, loss is observable, and surviving telemetry flushes in order.',
    passed,
    [
      `high-water mark: ${beforeReconnect.outbox.highWaterMark}`,
      `dropped oldest: ${beforeReconnect.outbox.droppedOldest}`,
      `final reconstructed value: ${String(finalValue)}`,
    ],
    [
      entry(0, 'offline', 'Node loses its broker session.', 'warning'),
      entry(1, 'overflow', 'Five updates enter a capacity-three queue.', 'warning'),
      entry(2, 'drop-policy', 'Two oldest updates are deliberately dropped.', 'info'),
      entry(
        3,
        'flush',
        'Three surviving updates flush after rebirth.',
        passed ? 'success' : 'failure',
      ),
    ],
  );
}

function authorizationScenario(): ScenarioResult {
  const harness = createHarness();
  let authenticationDenied = false;
  let crossNodePublishDenied = false;
  let crossGroupSubscribeDenied = false;

  try {
    harness.broker.connect('bad-client', NODE_USERNAME, 'wrong-password');
  } catch (error: unknown) {
    authenticationDenied = error instanceof AuthenticationError;
  }

  const nodeConnection = harness.broker.connect('acl-node', NODE_USERNAME, NODE_PASSWORD);
  try {
    nodeConnection.publish(
      buildLifecycleTopic({ event: 'data', groupId: GROUP_ID, nodeId: 'edge-02' }),
      '{}',
    );
  } catch (error: unknown) {
    crossNodePublishDenied = error instanceof AuthorizationError;
  }
  nodeConnection.disconnect();

  const consumerConnection = harness.broker.connect(
    'acl-consumer',
    CONSUMER_USERNAME,
    CONSUMER_PASSWORD,
  );
  try {
    consumerConnection.subscribe('reliability/v1/plant-b/nodes/+/events/+', () => undefined);
  } catch (error: unknown) {
    crossGroupSubscribeDenied = error instanceof AuthorizationError;
  }
  consumerConnection.disconnect();

  const passed = authenticationDenied && crossNodePublishDenied && crossGroupSubscribeDenied;
  return scenario(
    'authorization-boundaries',
    'Credential and namespace denial',
    'Prove invalid credentials, cross-node writes, and cross-group reads fail closed.',
    passed,
    [
      `bad credential denied: ${String(authenticationDenied)}`,
      `cross-node publish denied: ${String(crossNodePublishDenied)}`,
      `cross-group subscription denied: ${String(crossGroupSubscribeDenied)}`,
    ],
    [
      entry(
        0,
        'authenticate',
        'Invalid secret is rejected.',
        authenticationDenied ? 'success' : 'failure',
      ),
      entry(
        1,
        'publish-acl',
        'Node cannot write another node namespace.',
        crossNodePublishDenied ? 'success' : 'failure',
      ),
      entry(
        2,
        'subscribe-acl',
        'Consumer cannot read another group.',
        crossGroupSubscribeDenied ? 'success' : 'failure',
      ),
    ],
  );
}

function brokerRestartScenario(): ScenarioResult {
  const harness = createHarness();
  harness.consumer.connect();
  harness.node.connect();
  harness.node.publishMetrics([metric(harness.clock, 'motor.current', 8.25, 'float64', 'ampere')]);
  harness.broker.restart(true);
  harness.node.disconnectUnexpectedly();
  harness.consumer.disconnect();
  harness.consumer.connect();
  const offlineAfterRestart = harness.consumer.store().getNode(GROUP_ID, NODE_ID)?.online === false;
  harness.node.connect();
  const recovered = harness.consumer.store().getNode(GROUP_ID, NODE_ID);
  const passed =
    harness.broker.retainedCount() === 1 &&
    offlineAfterRestart &&
    recovered?.online === true &&
    recovered.metrics['motor.current']?.value === 8.25;

  return scenario(
    'broker-restart',
    'Persistent retained state across broker restart',
    'Prove offline truth survives restart and node rebirth restores its metric snapshot.',
    passed,
    [
      `offline snapshot after restart: ${String(offlineAfterRestart)}`,
      `restored motor current: ${String(recovered?.metrics['motor.current']?.value)}`,
    ],
    [
      entry(0, 'state', 'Broker holds one retained current-state message.', 'success'),
      entry(
        1,
        'restart',
        'Sessions terminate and the retained offline will replaces state.',
        'warning',
      ),
      entry(2, 'late-subscribe', 'Consumer bootstraps the offline truth.', 'success'),
      entry(
        3,
        'rebirth',
        'Node reconnects and republishes its metric snapshot.',
        passed ? 'success' : 'failure',
      ),
    ],
  );
}

function createHarness(outboxCapacity = 8): Harness {
  const broker = new InMemoryBroker();
  broker.registerCredential(NODE_USERNAME, NODE_PASSWORD, {
    groupId: GROUP_ID,
    nodeId: NODE_ID,
    role: 'node',
  });
  broker.registerCredential(CONSUMER_USERNAME, CONSUMER_PASSWORD, {
    groupId: GROUP_ID,
    role: 'consumer',
  });
  const clock = createDeterministicClock('2026-01-15T12:00:00.000Z');
  const ids = createDeterministicIdFactory();
  const node = new EdgeNode(
    broker,
    {
      clientId: 'edge-01-client',
      groupId: GROUP_ID,
      nodeId: NODE_ID,
      outboxCapacity,
      overflowPolicy: 'drop-oldest',
      password: NODE_PASSWORD,
      username: NODE_USERNAME,
    },
    clock,
    ids,
  );
  const consumer = new StateConsumer({
    broker,
    clientId: 'supervisor-client',
    clock,
    groupId: GROUP_ID,
    password: CONSUMER_PASSWORD,
    username: CONSUMER_USERNAME,
  });
  return { broker, clock, consumer, ids, node };
}

function metric(
  clock: Clock,
  name: string,
  value: number,
  dataType: 'float64' | 'int64',
  unit: string,
): Metric {
  return { dataType, name, quality: 'good', sourceTimestamp: clock().toISOString(), unit, value };
}

function entry(
  offset: number,
  event: string,
  detail: string,
  status: TimelineEntry['status'],
): TimelineEntry {
  return { detail, event, offset, status };
}

function scenario(
  id: string,
  title: string,
  purpose: string,
  passed: boolean,
  observations: readonly string[],
  timeline: readonly TimelineEntry[],
): ScenarioResult {
  return { id, observations, passed, purpose, timeline, title };
}
