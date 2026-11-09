/**
 * @file Simulated edge-node lifecycle client.
 * @description Publishes birth/data/death/state events and bounds telemetry while disconnected.
 * @exports EdgeNode, EdgeNodeConfiguration, EdgeNodeStatistics, Clock, IdFactory.
 * @data connection represents broker reachability; currentMetrics reconstructs retained state;
 * outbox stores validated TTL-bound metric batches; checkpoints exclude configuration and wire envelopes.
 */
import type { DropPolicy, EnqueueResult } from '../core/bounded-outbox.ts';
import {
  RecoveryOutbox,
  checkpointSchema,
  readCheckpoint,
  type RestoreResult,
  type RecoveryStatistics,
} from '../core/recovery-outbox.ts';
import { metricSchema } from '../core/contracts.ts';
import type { LifecycleEnvelope, Metric } from '../core/contracts.ts';
import { buildLifecycleTopic, type LifecycleEvent } from '../core/topic.ts';
import type { BrokerConnection, InMemoryBroker, WillPacket } from './in-memory-broker.ts';

export type Clock = () => Date;
export type IdFactory = () => string;

export interface EdgeNodeConfiguration {
  readonly clientId: string;
  readonly groupId: string;
  readonly nodeId: string;
  readonly outboxCapacity: number;
  readonly outboxTtlMs?: number;
  readonly overflowPolicy: DropPolicy;
  readonly password: string;
  readonly username: string;
}

export interface EdgeNodeStatistics {
  readonly birthSequence: number;
  readonly buffered: number;
  readonly connected: boolean;
  readonly outbox: RecoveryStatistics;
  readonly publishedDataEvents: number;
}

/** Edge client with explicit lifecycle and offline-buffer behavior. */
export class EdgeNode {
  readonly #broker: InMemoryBroker;
  readonly #clock: Clock;
  readonly #configuration: EdgeNodeConfiguration;
  readonly #currentMetrics = new Map<string, Metric>();
  readonly #idFactory: IdFactory;
  readonly #outbox: RecoveryOutbox;
  #started = false;
  #birthSequence = 0;
  #connection: BrokerConnection | undefined;
  #publishedDataEvents = 0;
  #seq = 0;

  constructor(
    broker: InMemoryBroker,
    configuration: EdgeNodeConfiguration,
    clock: Clock,
    idFactory: IdFactory,
  ) {
    this.#broker = broker;
    this.#configuration = configuration;
    this.#clock = clock;
    this.#idFactory = idFactory;
    this.#outbox = new RecoveryOutbox(
      configuration.outboxCapacity,
      configuration.overflowPolicy,
      configuration.outboxTtlMs,
    );
  }

  /** Opens a session, announces birth, updates retained state, then flushes buffered telemetry. */
  connect(): void {
    if (this.#connection !== undefined) {
      return;
    }

    if (this.#birthSequence === 4_294_967_295)
      throw new Error('birth sequence exhausted; assign a new node identity');
    this.#started = true;
    this.#birthSequence += 1;
    this.#seq = 0;
    const willEnvelope = this.#makeEnvelope('state', [...this.#currentMetrics.values()], {
      online: false,
      reason: 'ungraceful-disconnect',
    });
    const will: WillPacket = {
      payload: JSON.stringify(willEnvelope),
      retain: true,
      topic: this.#topic('state'),
    };

    this.#connection = this.#broker.connect(
      this.#configuration.clientId,
      this.#configuration.username,
      this.#configuration.password,
      will,
    );
    this.#publishEnvelope(this.#makeEnvelope('birth', [...this.#currentMetrics.values()]), false);
    this.#publishState(true);
    this.#flushOutbox();
  }

  /** Retries remaining buffered batches after a synchronous publish failure; returns this call's replay count. */
  retryBuffered(): number {
    if (this.#connection === undefined)
      throw new Error('retry requires an active broker connection');
    const before = this.#outbox.statistics().replayed;
    this.#flushOutbox();
    return this.#outbox.statistics().replayed - before;
  }

  /** Publishes immediately when connected or buffers one metric batch when offline. */
  publishMetrics(metrics: readonly Metric[]): EnqueueResult | 'published' {
    if (metrics.length < 1 || metrics.length > 256)
      throw new Error('metric batch must contain 1..256 metrics');
    const safeMetrics = metrics.map((metric) => metricSchema.parse(metric));
    if (this.#connection === undefined) {
      return this.#outbox.enqueue(safeMetrics, this.#clock().getTime());
    }

    this.#publishData(safeMetrics);
    return 'published';
  }

  /** Exports an offline, bounded checkpoint containing telemetry and node lifecycle state only. */
  checkpoint(): string {
    if (this.#connection !== undefined) throw new Error('checkpoint requires a disconnected node');
    const now = this.#clock().getTime();
    const checkpoint = checkpointSchema.parse({
      schemaVersion: 'outbox-1',
      groupId: this.#configuration.groupId,
      nodeId: this.#configuration.nodeId,
      birthSequence: this.#birthSequence,
      capturedAt: now,
      currentMetrics: [...this.#currentMetrics.values()],
      ...this.#outbox.snapshot(now),
    });
    const serialized = JSON.stringify(checkpoint);
    readCheckpoint(serialized);
    return serialized;
  }

  /** Validates the full checkpoint and identity before restoring into a never-connected fresh node. */
  restoreCheckpoint(serialized: string): RestoreResult {
    if (this.#started || this.#connection !== undefined)
      throw new Error('restore requires a never-connected node');
    const checkpoint = readCheckpoint(serialized);
    if (
      checkpoint.groupId !== this.#configuration.groupId ||
      checkpoint.nodeId !== this.#configuration.nodeId
    )
      throw new Error('checkpoint identity mismatch');
    const result = this.#outbox.restore(checkpoint, this.#clock().getTime());
    this.#birthSequence = checkpoint.birthSequence;
    for (const metric of checkpoint.currentMetrics)
      this.#currentMetrics.set(metric.name, structuredClone(metric));
    return result;
  }

  /** Publishes an explicit death plus retained offline state before a clean disconnect. */
  disconnectGracefully(reason = 'planned-shutdown'): void {
    if (this.#connection === undefined) {
      return;
    }
    const death = this.#makeEnvelope('death', [], { online: false, reason });
    this.#publishEnvelope(death, false);
    this.#publishState(false, reason);
    this.#connection.disconnect(true);
    this.#connection = undefined;
  }

  /** Drops the session so the broker publishes its pre-registered retained offline state. */
  disconnectUnexpectedly(): void {
    this.#connection?.disconnect(false);
    this.#connection = undefined;
  }

  statistics(): EdgeNodeStatistics {
    return {
      birthSequence: this.#birthSequence,
      buffered: this.#outbox.length,
      connected: this.#connection !== undefined,
      outbox: this.#outbox.statistics(),
      publishedDataEvents: this.#publishedDataEvents,
    };
  }

  #flushOutbox(): void {
    while (
      this.#outbox.replayOne(this.#clock().getTime(), (metrics) => this.#publishData(metrics))
    ) {
      // Synchronous publication failures retain the current batch for an explicit retry.
    }
  }

  #publishData(metrics: readonly Metric[]): void {
    this.#seq = (this.#seq + 1) & 0xff;
    for (const metric of metrics) {
      this.#currentMetrics.set(metric.name, structuredClone(metric));
    }
    this.#publishEnvelope(this.#makeEnvelope('data', metrics), false);
    this.#publishState(true);
    this.#publishedDataEvents += 1;
  }

  #publishState(online: boolean, reason?: string): void {
    const options = reason === undefined ? { online } : { online, reason };
    this.#publishEnvelope(
      this.#makeEnvelope('state', [...this.#currentMetrics.values()], options),
      true,
    );
  }

  #publishEnvelope(envelope: LifecycleEnvelope, retain: boolean): void {
    const connection = this.#connection;
    if (connection === undefined) {
      throw new Error('cannot publish without an active broker connection');
    }
    connection.publish(this.#topic(envelope.event), JSON.stringify(envelope), { retain });
  }

  #makeEnvelope(
    event: LifecycleEvent,
    metrics: readonly Metric[],
    options: { readonly online?: boolean; readonly reason?: string } = {},
  ): LifecycleEnvelope {
    const now = this.#clock().toISOString();
    const base = {
      birthSequence: this.#birthSequence,
      event,
      groupId: this.#configuration.groupId,
      messageId: this.#idFactory(),
      metrics: metrics.map((metric) => structuredClone(metric)),
      nodeId: this.#configuration.nodeId,
      online: options.online ?? true,
      schemaVersion: '1.0' as const,
      seq: this.#seq,
      sourceTimestamp: now,
    };
    return options.reason === undefined ? base : { ...base, reason: options.reason };
  }

  #topic(event: LifecycleEvent): string {
    return buildLifecycleTopic({
      event,
      groupId: this.#configuration.groupId,
      nodeId: this.#configuration.nodeId,
    });
  }
}
