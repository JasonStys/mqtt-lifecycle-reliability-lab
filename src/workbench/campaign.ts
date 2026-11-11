/**
 * @file Editable offline reliability campaigns using the original broker, publisher and consumer.
 * @description Strict bounded input, exact simulated time and explicit per-event failures; no network adapters.
 * @exports parseProject, preparedProject, replayProject, runOriginalCampaign, projectSchema.
 * @data project is data only; result snapshots retain original queue counters, observations and checkpoint bytes.
 */
import { z } from 'zod';
import { metricSchema } from '../core/contracts.ts';
import { readCheckpoint } from '../core/recovery-outbox.ts';
import { EdgeNode } from '../lab/edge-node.ts';
import { InMemoryBroker } from '../lab/in-memory-broker.ts';
import { StateConsumer } from '../lab/state-consumer.ts';
import { createDeterministicIdFactory } from '../lab/determinism.ts';
import { runScenarioSuite } from '../lab/scenario-suite.ts';

export const MAX_PROJECT_BYTES = 65_536;
const identity = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/);
const offset = z.number().int().min(0).max(86_400_000);
const simple = <T extends string>(type: T) =>
  z.object({ type: z.literal(type), atMs: offset }).strict();
const eventSchema = z.discriminatedUnion('type', [
  simple('connect'),
  simple('disconnect'),
  simple('crash'),
  simple('subscribe'),
  simple('new-consumer'),
  simple('unsubscribe'),
  simple('checkpoint'),
  simple('restore'),
  simple('duplicate-last'),
  simple('inspect'),
  z
    .object({ type: z.literal('restart-broker'), atMs: offset, preserveRetained: z.boolean() })
    .strict(),
  z
    .object({
      type: z.literal('publish'),
      atMs: offset,
      metrics: z.array(metricSchema).min(1).max(16),
    })
    .strict(),
]);
/** Exact owned configuration; endpoint, credential and executable fields do not exist. */
export const projectSchema = z
  .object({
    schema: z.literal(1),
    title: z.string().trim().min(1).max(100),
    groupId: identity,
    nodeId: identity,
    start: z
      .string()
      .datetime({ offset: true })
      .refine((value) => {
        const time = Date.parse(value);
        return Number.isFinite(time) && time >= 0 && time <= 8_639_999_913_600_000;
      }),
    capacity: z.number().int().min(1).max(1_000),
    restoreCapacity: z.number().int().min(1).max(1_000),
    ttlMs: z.number().int().min(1).max(86_400_000),
    overflowPolicy: z.enum(['drop-oldest', 'reject-newest']),
    events: z.array(eventSchema).min(1).max(128),
  })
  .strict()
  .superRefine((project, context) => {
    let prior = 0;
    for (const [index, event] of project.events.entries()) {
      if (event.atMs < prior)
        context.addIssue({
          code: 'custom',
          path: ['events', index, 'atMs'],
          message: 'event time cannot move backward',
        });
      prior = event.atMs;
    }
  });
export type CampaignProject = z.infer<typeof projectSchema>;

/** Validate every event before replacing a last-good applied project or starting a replay. */
export function parseProject(serialized: string): CampaignProject {
  if (
    serialized.length > MAX_PROJECT_BYTES ||
    new TextEncoder().encode(serialized).byteLength > MAX_PROJECT_BYTES
  )
    throw new Error('Campaign exceeds 64 KiB.');
  return projectSchema.parse(JSON.parse(serialized));
}

/** Three realistic editable inputs inside the complete application, never separate demo programs. */
export function preparedProject(kind: 'cold-chain' | 'factory' | 'utility'): CampaignProject {
  const start = '2026-01-15T12:00:00.000Z';
  const reading = (atMs: number, value: number, name = 'cargo.temperature', unit = 'celsius') => ({
    type: 'publish' as const,
    atMs,
    metrics: [
      {
        name,
        value,
        unit,
        quality: 'good' as const,
        dataType: 'float64' as const,
        sourceTimestamp: new Date(Date.parse(start) + atMs).toISOString(),
      },
    ],
  });
  const base = {
    schema: 1 as const,
    title: 'Cold-chain process replacement',
    groupId: 'cold-chain',
    nodeId: 'van-07',
    start,
    capacity: 4,
    restoreCapacity: 2,
    ttlMs: 1_000,
    overflowPolicy: 'drop-oldest' as const,
  };
  if (kind === 'cold-chain')
    return projectSchema.parse({
      ...base,
      events: [
        { type: 'subscribe', atMs: 0 },
        { type: 'connect', atMs: 0 },
        { type: 'disconnect', atMs: 0 },
        reading(0, 4.1),
        reading(700, 4.2),
        reading(800, 4.3),
        reading(900, 4.4),
        { type: 'checkpoint', atMs: 900 },
        { type: 'restore', atMs: 1_100 },
        { type: 'connect', atMs: 1_100 },
      ],
    });
  if (kind === 'factory')
    return projectSchema.parse({
      ...base,
      title: 'Factory late subscriber and duplicate delivery',
      groupId: 'assembly',
      nodeId: 'line-02',
      ttlMs: 60_000,
      events: [
        { type: 'connect', atMs: 0 },
        reading(100, 42, 'line.speed', 'rpm'),
        { type: 'subscribe', atMs: 200 },
        reading(300, 45, 'line.speed', 'rpm'),
        { type: 'duplicate-last', atMs: 400 },
        { type: 'crash', atMs: 500 },
        { type: 'connect', atMs: 600 },
        { type: 'inspect', atMs: 600 },
      ],
    });
  return projectSchema.parse({
    ...base,
    title: 'Utility reject-newest outage and broker restart',
    groupId: 'water',
    nodeId: 'pump-03',
    capacity: 2,
    restoreCapacity: 2,
    ttlMs: 60_000,
    overflowPolicy: 'reject-newest',
    events: [
      { type: 'subscribe', atMs: 0 },
      { type: 'connect', atMs: 0 },
      { type: 'crash', atMs: 50 },
      reading(100, 201, 'flow.rate', 'liters/min'),
      reading(200, 202, 'flow.rate', 'liters/min'),
      reading(300, 203, 'flow.rate', 'liters/min'),
      { type: 'connect', atMs: 400 },
      { type: 'restart-broker', atMs: 500, preserveRetained: true },
      { type: 'new-consumer', atMs: 600 },
      { type: 'connect', atMs: 700 },
    ],
  });
}

/** Rebuild an isolated engine for every prefix. Step-back never mutates an already displayed result. */
export function replayProject(input: CampaignProject, count = input.events.length) {
  const project = parseProject(JSON.stringify(input));
  if (!Number.isSafeInteger(count) || count < 0 || count > project.events.length)
    throw new Error('Replay cursor must select an exact event prefix.');
  const broker = new InMemoryBroker();
  // These fixed credentials exist only inside this isolated deterministic broker; never connect a real adapter.
  const password = 'offline-simulation-only';
  broker.registerCredential('simulation-node', password, {
    role: 'node',
    groupId: project.groupId,
    nodeId: project.nodeId,
  });
  broker.registerCredential('simulation-consumer', password, {
    role: 'consumer',
    groupId: project.groupId,
  });
  let now = Date.parse(project.start);
  const clock = () => new Date(now);
  const ids = createDeterministicIdFactory();
  const node = (capacity: number) =>
    new EdgeNode(
      broker,
      {
        clientId: 'simulation-publisher',
        groupId: project.groupId,
        nodeId: project.nodeId,
        outboxCapacity: capacity,
        outboxTtlMs: project.ttlMs,
        overflowPolicy: project.overflowPolicy,
        username: 'simulation-node',
        password,
      },
      clock,
      ids,
    );
  const consumer = () =>
    new StateConsumer({
      broker,
      clientId: 'simulation-reader',
      clock,
      groupId: project.groupId,
      username: 'simulation-consumer',
      password,
    });
  let publisher = node(project.capacity),
    reader = consumer(),
    checkpoint: string | null = null;
  const rows = [];
  for (const [index, event] of project.events.slice(0, count).entries()) {
    now = Date.parse(project.start) + event.atMs;
    let detail: unknown = null,
      error: string | null = null;
    try {
      switch (event.type) {
        case 'connect':
          publisher.connect();
          break;
        case 'disconnect':
          publisher.disconnectGracefully();
          break;
        case 'crash':
          publisher.disconnectUnexpectedly();
          break;
        case 'subscribe':
          reader.connect();
          break;
        case 'unsubscribe':
          reader.disconnect();
          break;
        case 'new-consumer':
          reader.disconnect();
          reader = consumer();
          reader.connect();
          break;
        case 'publish':
          detail = publisher.publishMetrics(event.metrics);
          break;
        case 'checkpoint':
          checkpoint = publisher.checkpoint();
          detail = readCheckpoint(checkpoint);
          break;
        case 'restore': {
          if (checkpoint === null)
            throw new Error('Create a disconnected checkpoint before restoring.');
          if (publisher.statistics().connected)
            throw new Error('Disconnect the old publisher before process replacement.');
          const replacement = node(project.restoreCapacity);
          detail = replacement.restoreCheckpoint(checkpoint);
          publisher = replacement;
          break;
        }
        case 'restart-broker':
          broker.restart(event.preserveRetained);
          publisher.disconnectUnexpectedly();
          reader.disconnect();
          break;
        case 'duplicate-last': {
          const last = broker.publicationLog().at(-1);
          if (!last) throw new Error('Publish a lifecycle envelope before duplicate injection.');
          detail = reader.store().ingest(last.topic, last.payload, clock());
          break;
        }
        case 'inspect':
          break;
      }
    } catch (failure: unknown) {
      error =
        failure instanceof Error ? failure.message.slice(0, 1_000) : 'Offline operation rejected.';
    }
    rows.push({
      index,
      event: structuredClone(event),
      outcome: error === null ? 'completed' : 'rejected',
      error,
      detail,
      publisher: publisher.statistics(),
      snapshot: reader.store().snapshot(),
      statistics: reader.store().statistics(),
      observations: reader.observations().length,
      retainedMessages: broker.retainedCount(),
    });
  }
  const result = {
    schema: 1,
    title: project.title,
    cursor: count,
    totalEvents: project.events.length,
    rejectedOperations: rows.filter((row) => row.outcome === 'rejected').length,
    rows,
    publisher: publisher.statistics(),
    snapshot: reader.store().snapshot(),
    statistics: reader.store().statistics(),
    observations: reader.observations(),
    publications: broker.publicationLog(),
    checkpoint,
    limits: [
      'Offline deterministic broker, not MQTT/Sparkplug wire conformance or a live broker connection.',
      'Counters belong to the current simulated publisher/consumer; process replacement is explicit in the event rows.',
      'Queue TTL expiry occurs on original queue operations, not an autonomous wall-clock timer.',
    ],
  };
  publisher.disconnectUnexpectedly();
  reader.disconnect();
  return result;
}

/** Preserve the original independent seven-scenario engine as a separate, explicitly labeled check. */
export function runOriginalCampaign() {
  return runScenarioSuite('2026-01-15T12:00:00.000Z');
}
