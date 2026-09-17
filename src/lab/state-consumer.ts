/**
 * @file Simulated supervisory lifecycle consumer.
 * @description Subscribes to one group, reconstructs node state, and records every ingest result.
 * @exports StateConsumer, ConsumerObservation.
 * @data observations preserves receive order; store owns current reconstructed state and counters.
 */
import { StateStore, type IngestionResult } from '../core/state-store.ts';
import { buildGroupSubscription } from '../core/topic.ts';
import type { Clock } from './edge-node.ts';
import type { BrokerConnection, InMemoryBroker } from './in-memory-broker.ts';

export interface ConsumerObservation {
  readonly receivedAt: string;
  readonly result: IngestionResult;
  readonly retained: boolean;
  readonly topic: string;
}

/** Group-scoped consumer used by the scenarios and integration tests. */
export class StateConsumer {
  readonly #broker: InMemoryBroker;
  readonly #clientId: string;
  readonly #clock: Clock;
  readonly #groupId: string;
  readonly #observations: ConsumerObservation[] = [];
  readonly #password: string;
  readonly #store: StateStore;
  readonly #username: string;
  #connection: BrokerConnection | undefined;

  constructor(options: {
    readonly broker: InMemoryBroker;
    readonly clientId: string;
    readonly clock: Clock;
    readonly groupId: string;
    readonly password: string;
    readonly store?: StateStore;
    readonly username: string;
  }) {
    this.#broker = options.broker;
    this.#clientId = options.clientId;
    this.#clock = options.clock;
    this.#groupId = options.groupId;
    this.#password = options.password;
    this.#store = options.store ?? new StateStore();
    this.#username = options.username;
  }

  connect(): void {
    if (this.#connection !== undefined) {
      return;
    }
    this.#connection = this.#broker.connect(this.#clientId, this.#username, this.#password);
    this.#connection.subscribe(buildGroupSubscription(this.#groupId), (delivery) => {
      const receivedAt = this.#clock();
      const result = this.#store.ingest(delivery.topic, delivery.payload, receivedAt);
      this.#observations.push({
        receivedAt: receivedAt.toISOString(),
        result,
        retained: delivery.retained,
        topic: delivery.topic,
      });
    });
  }

  disconnect(): void {
    this.#connection?.disconnect(true);
    this.#connection = undefined;
  }

  observations(): readonly ConsumerObservation[] {
    return structuredClone(this.#observations);
  }

  store(): StateStore {
    return this.#store;
  }
}
