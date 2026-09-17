/**
 * @file Deterministic broker test double.
 * @description Models authentication, ACL checks, retained delivery, subscriptions, and wills.
 * @exports InMemoryBroker, BrokerConnection, BrokerDelivery, AuthenticationError, AuthorizationError.
 * @data credentials holds lab-only identities; retained persists current-state packets; subscriptions
 * routes matching deliveries; connections own last-will packets.
 */
import { AuthorizationPolicy, type Principal } from '../core/authorization.ts';

export interface BrokerDelivery {
  readonly payload: string;
  readonly retained: boolean;
  readonly topic: string;
}

export interface BrokerPublication extends BrokerDelivery {
  readonly publisherClientId: string;
}

export interface PublishOptions {
  readonly retain?: boolean;
}

export interface WillPacket {
  readonly payload: string;
  readonly retain: boolean;
  readonly topic: string;
}

interface CredentialRecord {
  readonly password: string;
  readonly principal: Principal;
}

interface Subscription {
  readonly clientId: string;
  readonly filter: string;
  readonly handler: (delivery: BrokerDelivery) => void;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/** Handle returned to one authenticated simulated broker client. */
export class BrokerConnection {
  #closed = false;

  constructor(
    private readonly broker: InMemoryBroker,
    readonly clientId: string,
    readonly principal: Principal,
  ) {}

  publish(topic: string, payload: string, options: PublishOptions = {}): number {
    this.#assertOpen();
    return this.broker.publishFrom(
      this.clientId,
      this.principal,
      topic,
      payload,
      options.retain ?? false,
    );
  }

  subscribe(filter: string, handler: (delivery: BrokerDelivery) => void): void {
    this.#assertOpen();
    this.broker.subscribeFrom(this.clientId, this.principal, filter, handler);
  }

  disconnect(graceful = true): void {
    if (!this.#closed) {
      this.#closed = true;
      this.broker.disconnectClient(this.clientId, graceful);
    }
  }

  markClosedByBroker(): void {
    this.#closed = true;
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new Error(`client ${this.clientId} is disconnected`);
    }
  }
}

/** Small deterministic broker boundary used by integration tests and fault scenarios. */
export class InMemoryBroker {
  readonly #authorization = new AuthorizationPolicy();
  readonly #connections = new Map<string, { connection: BrokerConnection; will?: WillPacket }>();
  readonly #credentials = new Map<string, CredentialRecord>();
  readonly #retained = new Map<string, string>();
  readonly #subscriptions: Subscription[] = [];
  readonly #publications: BrokerPublication[] = [];

  registerCredential(username: string, password: string, principal: Principal): void {
    if (username.length < 1 || password.length < 8) {
      throw new Error('lab credentials require a username and an eight-character password');
    }
    this.#credentials.set(username, { password, principal });
  }

  connect(
    clientId: string,
    username: string,
    password: string,
    will?: WillPacket,
  ): BrokerConnection {
    const record = this.#credentials.get(username);
    if (record === undefined || record.password !== password) {
      throw new AuthenticationError('bad username or password');
    }
    if (this.#connections.has(clientId)) {
      this.disconnectClient(clientId, false);
    }

    const connection = new BrokerConnection(this, clientId, record.principal);
    this.#connections.set(clientId, will === undefined ? { connection } : { connection, will });
    return connection;
  }

  /** Stops all sessions and optionally preserves retained state, as a persistent broker would. */
  restart(preserveRetained: boolean): void {
    for (const clientId of [...this.#connections.keys()]) {
      this.disconnectClient(clientId, false);
    }
    this.#subscriptions.splice(0);
    if (!preserveRetained) {
      this.#retained.clear();
    }
  }

  retainedCount(): number {
    return this.#retained.size;
  }

  publicationLog(): readonly BrokerPublication[] {
    return structuredClone(this.#publications);
  }

  /** Redelivers a prior publication to emulate QoS retry or delayed network delivery. */
  replay(publicationIndex: number): number {
    const publication = this.#publications[publicationIndex];
    if (publication === undefined) {
      throw new RangeError('publication index is outside the broker log');
    }
    return this.#deliver(publication.topic, publication.payload, false);
  }

  publishFrom(
    clientId: string,
    principal: Principal,
    topic: string,
    payload: string,
    retain: boolean,
  ): number {
    const decision = this.#authorization.authorizePublish(principal, topic);
    if (!decision.allowed) {
      throw new AuthorizationError(decision.reason);
    }

    if (retain) {
      if (payload.length === 0) {
        this.#retained.delete(topic);
      } else {
        this.#retained.set(topic, payload);
      }
    }
    this.#publications.push({ payload, publisherClientId: clientId, retained: retain, topic });
    return this.#deliver(topic, payload, false);
  }

  subscribeFrom(
    clientId: string,
    principal: Principal,
    filter: string,
    handler: (delivery: BrokerDelivery) => void,
  ): void {
    const decision = this.#authorization.authorizeSubscribe(principal, filter);
    if (!decision.allowed) {
      throw new AuthorizationError(decision.reason);
    }
    this.#subscriptions.push({ clientId, filter, handler });

    for (const [topic, payload] of this.#retained.entries()) {
      if (topicMatches(filter, topic)) {
        handler({ payload, retained: true, topic });
      }
    }
  }

  disconnectClient(clientId: string, graceful: boolean): void {
    const entry = this.#connections.get(clientId);
    if (entry === undefined) {
      return;
    }

    this.#connections.delete(clientId);
    entry.connection.markClosedByBroker();
    for (let index = this.#subscriptions.length - 1; index >= 0; index -= 1) {
      if (this.#subscriptions[index]?.clientId === clientId) {
        this.#subscriptions.splice(index, 1);
      }
    }

    if (!graceful && entry.will !== undefined) {
      this.publishFrom(
        clientId,
        entry.connection.principal,
        entry.will.topic,
        entry.will.payload,
        entry.will.retain,
      );
    }
  }

  #deliver(topic: string, payload: string, retained: boolean): number {
    let deliveries = 0;
    for (const subscription of [...this.#subscriptions]) {
      if (topicMatches(subscription.filter, topic)) {
        subscription.handler({ payload, retained, topic });
        deliveries += 1;
      }
    }
    return deliveries;
  }
}

function topicMatches(filter: string, topic: string): boolean {
  const filterSegments = filter.split('/');
  const topicSegments = topic.split('/');
  if (filterSegments.length !== topicSegments.length) {
    return false;
  }
  return filterSegments.every(
    (segment, index) => segment === '+' || segment === topicSegments[index],
  );
}
