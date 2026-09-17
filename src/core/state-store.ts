/**
 * @file Deterministic node-state reconstruction.
 * @description Validates lifecycle messages, detects delivery anomalies, and builds current state.
 * @exports StateStore, NodeState, StoreStatistics, IngestionResult.
 * @data nodes contains reconstructed state; seenMessageIds is bounded to prevent memory leaks.
 */
import { parseEnvelope, type LifecycleEnvelope, type Metric } from './contracts.ts';
import { assessSequence, type SequenceAssessment } from './sequence.ts';
import { parseLifecycleTopic } from './topic.ts';

export interface NodeState {
  readonly birthSequence: number;
  readonly groupId: string;
  readonly lastEvent: LifecycleEnvelope['event'];
  readonly lastReceivedAt: string;
  readonly lastSourceTimestamp: string;
  readonly metrics: Readonly<Record<string, Metric>>;
  readonly nodeId: string;
  readonly online: boolean;
  readonly seq: number;
}

export interface StoreStatistics {
  readonly accepted: number;
  readonly clockSkewWarnings: number;
  readonly duplicateMessages: number;
  readonly duplicateSequences: number;
  readonly gaps: number;
  readonly invalid: number;
  readonly missingMessages: number;
  readonly orphanData: number;
  readonly outOfOrder: number;
}

export type IngestionResult =
  | {
      readonly envelope: LifecycleEnvelope;
      readonly kind: 'accepted';
      readonly sequence: SequenceAssessment | undefined;
      readonly warning: string | undefined;
    }
  | { readonly kind: 'duplicate-message'; readonly messageId: string }
  | { readonly error: string; readonly kind: 'rejected' };

/** Reconstructs current node state from untrusted topic/payload pairs. */
export class StateStore {
  readonly #dedupeLimit: number;
  readonly #nodes = new Map<string, NodeState>();
  readonly #seenMessageIds = new Map<string, true>();
  #accepted = 0;
  #clockSkewWarnings = 0;
  #duplicateMessages = 0;
  #duplicateSequences = 0;
  #gaps = 0;
  #invalid = 0;
  #missingMessages = 0;
  #orphanData = 0;
  #outOfOrder = 0;

  constructor(dedupeLimit = 512) {
    if (!Number.isSafeInteger(dedupeLimit) || dedupeLimit < 1) {
      throw new RangeError('dedupeLimit must be a positive safe integer');
    }
    this.#dedupeLimit = dedupeLimit;
  }

  /** Validates and applies one broker delivery. */
  ingest(topic: string, payload: Uint8Array | string, receivedAt: Date): IngestionResult {
    const parsedTopic = parseLifecycleTopic(topic);
    if (parsedTopic === undefined) {
      return this.#reject('invalid lifecycle topic');
    }

    const parsedEnvelope = parseEnvelope(payload);
    if (!parsedEnvelope.ok) {
      return this.#reject(parsedEnvelope.error);
    }

    const envelope = parsedEnvelope.value;
    if (
      envelope.groupId !== parsedTopic.groupId ||
      envelope.nodeId !== parsedTopic.nodeId ||
      envelope.event !== parsedTopic.event
    ) {
      return this.#reject('topic identity does not match payload identity');
    }

    if (this.#seenMessageIds.has(envelope.messageId)) {
      this.#duplicateMessages += 1;
      return { kind: 'duplicate-message', messageId: envelope.messageId };
    }
    this.#rememberMessageId(envelope.messageId);

    const key = nodeKey(envelope.groupId, envelope.nodeId);
    const prior = this.#nodes.get(key);
    if (envelope.event === 'data' && prior === undefined) {
      this.#orphanData += 1;
      return this.#reject('data arrived before birth or retained state');
    }

    const sequence = assessEnvelopeSequence(prior, envelope);
    this.#recordSequence(sequence);

    // Old packets are observed but cannot roll current state backward.
    if (sequence?.kind === 'out-of-order') {
      this.#accepted += 1;
      return {
        envelope,
        kind: 'accepted',
        sequence,
        warning: 'out-of-order event observed without mutating current state',
      };
    }

    const receivedTimestamp = receivedAt.toISOString();
    const sourceTime = Date.parse(envelope.sourceTimestamp);
    const clockSkewMs = Math.abs(receivedAt.getTime() - sourceTime);
    const warning =
      clockSkewMs > 5 * 60_000
        ? 'source and receive clocks differ by over five minutes'
        : undefined;
    if (warning !== undefined) {
      this.#clockSkewWarnings += 1;
    }

    const nextMetrics = mergeMetrics(prior?.metrics, envelope);
    this.#nodes.set(key, {
      birthSequence: envelope.birthSequence,
      groupId: envelope.groupId,
      lastEvent: envelope.event,
      lastReceivedAt: receivedTimestamp,
      lastSourceTimestamp: envelope.sourceTimestamp,
      metrics: nextMetrics,
      nodeId: envelope.nodeId,
      online: envelope.online,
      seq: envelope.seq,
    });
    this.#accepted += 1;
    return { envelope, kind: 'accepted', sequence, warning };
  }

  getNode(groupId: string, nodeId: string): NodeState | undefined {
    const state = this.#nodes.get(nodeKey(groupId, nodeId));
    return state === undefined ? undefined : structuredClone(state);
  }

  snapshot(): readonly NodeState[] {
    return [...this.#nodes.values()]
      .map((state) => structuredClone(state))
      .sort((left, right) =>
        nodeKey(left.groupId, left.nodeId).localeCompare(nodeKey(right.groupId, right.nodeId)),
      );
  }

  statistics(): StoreStatistics {
    return {
      accepted: this.#accepted,
      clockSkewWarnings: this.#clockSkewWarnings,
      duplicateMessages: this.#duplicateMessages,
      duplicateSequences: this.#duplicateSequences,
      gaps: this.#gaps,
      invalid: this.#invalid,
      missingMessages: this.#missingMessages,
      orphanData: this.#orphanData,
      outOfOrder: this.#outOfOrder,
    };
  }

  #recordSequence(sequence: SequenceAssessment | undefined): void {
    if (sequence?.kind === 'duplicate') {
      this.#duplicateSequences += 1;
    } else if (sequence?.kind === 'gap') {
      this.#gaps += 1;
      this.#missingMessages += sequence.missing;
    } else if (sequence?.kind === 'out-of-order') {
      this.#outOfOrder += 1;
    }
  }

  #reject(error: string): IngestionResult {
    this.#invalid += 1;
    return { error, kind: 'rejected' };
  }

  #rememberMessageId(messageId: string): void {
    this.#seenMessageIds.set(messageId, true);
    if (this.#seenMessageIds.size > this.#dedupeLimit) {
      const oldest = this.#seenMessageIds.keys().next().value;
      if (oldest !== undefined) {
        this.#seenMessageIds.delete(oldest);
      }
    }
  }
}

function assessEnvelopeSequence(
  prior: NodeState | undefined,
  envelope: LifecycleEnvelope,
): SequenceAssessment | undefined {
  if (envelope.event === 'state' || envelope.event === 'death') {
    return undefined;
  }
  if (envelope.event === 'birth' || prior?.birthSequence !== envelope.birthSequence) {
    return assessSequence(undefined, envelope.seq);
  }
  return assessSequence(prior.seq, envelope.seq);
}

function mergeMetrics(
  priorMetrics: Readonly<Record<string, Metric>> | undefined,
  envelope: LifecycleEnvelope,
): Readonly<Record<string, Metric>> {
  if (envelope.event === 'birth' || envelope.event === 'state') {
    return Object.fromEntries(envelope.metrics.map((metric) => [metric.name, metric]));
  }

  const next = { ...(priorMetrics ?? {}) };
  for (const metric of envelope.metrics) {
    next[metric.name] = metric;
  }
  return next;
}

function nodeKey(groupId: string, nodeId: string): string {
  return `${groupId}/${nodeId}`;
}
