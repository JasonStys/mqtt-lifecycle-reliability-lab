/**
 * @file Simulated edge-node lifecycle client.
 * @description Publishes birth/data/death/state events and bounds telemetry while disconnected.
 * @exports EdgeNode, EdgeNodeConfiguration, EdgeNodeStatistics, Clock, IdFactory.
 * @data connection represents broker reachability; currentMetrics reconstructs retained state;
 * outbox stores bounded metric batches rather than stale envelopes so reconnect assigns a new birth.
 */
import { BoundedOutbox, type DropPolicy, type EnqueueResult } from '../core/bounded-outbox.ts';
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
  readonly overflowPolicy: DropPolicy;
  readonly password: string;
  readonly username: string;
}

export interface EdgeNodeStatistics {
  readonly birthSequence: number;
  readonly buffered: number;
  readonly connected: boolean;
  readonly outbox: ReturnType<BoundedOutbox<readonly Metric[]>['statistics']>;
  readonly publishedDataEvents: number;
}

/** Edge client with explicit lifecycle and offline-buffer behavior. */
export class EdgeNode {
  readonly #broker: InMemoryBroker;
  readonly #clock: Clock;
  readonly #configuration: EdgeNodeConfiguration;
  readonly #currentMetrics = new Map<string, Metric>();
  readonly #idFactory: IdFactory;
  readonly #outbox: BoundedOutbox<readonly Metric[]>;
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
    this.#outbox = new BoundedOutbox(configuration.outboxCapacity, configuration.overflowPolicy);
  }

  /** Opens a session, announces birth, updates retained state, then flushes buffered telemetry. */
  connect(): void {
    if (this.#connection !== undefined) {
      return;
    }

    this.#birthSequence = (this.#birthSequence + 1) >>> 0;
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

  /** Publishes immediately when connected or buffers one metric batch when offline. */
  publishMetrics(metrics: readonly Metric[]): EnqueueResult | 'published' {
    const safeMetrics = metrics.map((metric) => structuredClone(metric));
    if (this.#connection === undefined) {
      return this.#outbox.enqueue(safeMetrics);
    }

    this.#publishData(safeMetrics);
    return 'published';
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
    let metrics = this.#outbox.dequeue();
    while (metrics !== undefined) {
      this.#publishData(metrics);
      metrics = this.#outbox.dequeue();
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
