/**
 * @file TTL-aware telemetry recovery queue; see docs/code-map.md for line anchors.
 * @description Holds bounded metric batches and validates versioned, credential-free checkpoints.
 * @exports RecoveryOutbox, checkpointSchema, readCheckpoint, RestoreResult.
 * @data entries keep original enqueue/expiry times and increasing ordinals; counters expose loss.
 */
import { z } from 'zod';
import { metricSchema, type Metric } from './contracts.ts';
import type { DropPolicy, EnqueueResult, OutboxStatistics } from './bounded-outbox.ts';

export const MAX_CHECKPOINT_BYTES = 1_048_576;
const MAX_TTL = 86_400_000;
const timestamp = z.number().int().min(0).max(8_640_000_000_000_000);
const batchSchema = z.array(metricSchema).min(1).max(256);
const entrySchema = z
  .object({
    ordinal: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    enqueuedAt: timestamp,
    expiresAt: timestamp,
    metrics: batchSchema,
  })
  .strict();
const identity = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
/** Strict checkpoint boundary; measurements are data, never credentials or executable envelopes. */
export const checkpointSchema = z
  .object({
    schemaVersion: z.literal('outbox-1'),
    groupId: identity,
    nodeId: identity,
    capturedAt: timestamp,
    birthSequence: z.number().int().min(0).max(4_294_967_294),
    currentMetrics: z.array(metricSchema).max(256),
    lastOrdinal: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    entries: z.array(entrySchema).max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    let previous = 0;
    for (const entry of value.entries) {
      if (
        entry.ordinal <= previous ||
        entry.ordinal > value.lastOrdinal ||
        entry.enqueuedAt > value.capturedAt ||
        entry.expiresAt <= entry.enqueuedAt ||
        entry.expiresAt - entry.enqueuedAt > MAX_TTL
      ) {
        context.addIssue({ code: 'custom', message: 'invalid checkpoint ordering or lifetime' });
      }
      previous = entry.ordinal;
    }
    if (
      new Set(value.currentMetrics.map((metric) => metric.name)).size !==
      value.currentMetrics.length
    ) {
      context.addIssue({ code: 'custom', message: 'duplicate current metric name' });
    }
  });
export type Checkpoint = z.infer<typeof checkpointSchema>;
type Entry = z.infer<typeof entrySchema>;
export interface RestoreResult {
  readonly restored: number;
  readonly expired: number;
  readonly capacityDropped: number;
}
export interface RecoveryStatistics extends OutboxStatistics {
  readonly expired: number;
  readonly replayed: number;
  readonly restored: number;
}

/** Rejects oversized or malformed JSON before any queue mutation; callers bind its node identity. */
export function readCheckpoint(serialized: string): Checkpoint {
  if (
    serialized.length > MAX_CHECKPOINT_BYTES ||
    new TextEncoder().encode(serialized).byteLength > MAX_CHECKPOINT_BYTES
  )
    throw new Error('checkpoint exceeds 1 MiB');
  return checkpointSchema.parse(JSON.parse(serialized));
}

/** FIFO recovery queue. All mutations validate time; restore is allowed once on a pristine queue. */
export class RecoveryOutbox {
  readonly #capacity: number;
  readonly #policy: DropPolicy;
  readonly #ttl: number;
  #entries: Entry[] = [];
  #lastOrdinal = 0;
  #lastTime = 0;
  #used = false;
  #accepted = 0;
  #droppedOldest = 0;
  #rejectedNewest = 0;
  #highWaterMark = 0;
  #expired = 0;
  #replayed = 0;
  #restored = 0;

  constructor(capacity: number, policy: DropPolicy, ttlMs = MAX_TTL) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1_000)
      throw new RangeError('capacity must be 1..1000');
    if (policy !== 'drop-oldest' && policy !== 'reject-newest')
      throw new Error('unknown overflow policy');
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > MAX_TTL)
      throw new RangeError('TTL must be 1..86400000 ms');
    this.#capacity = capacity;
    this.#policy = policy;
    this.#ttl = ttlMs;
  }

  get length(): number {
    return this.#entries.length;
  }

  /** Validates a complete batch before expiring/enqueuing; rejects ordinal exhaustion, never wraps. */
  enqueue(metrics: readonly Metric[], now: number): EnqueueResult {
    const safe = batchSchema.parse(metrics);
    this.#validateTime(now);
    if (this.#lastOrdinal === Number.MAX_SAFE_INTEGER || now + this.#ttl > 8_640_000_000_000_000)
      throw new Error('queue clock or ordinal exhausted');
    this.#expire(now);
    this.#used = true;
    if (this.#entries.length === this.#capacity && this.#policy === 'reject-newest') {
      this.#rejectedNewest += 1;
      return 'rejected';
    }
    let result: EnqueueResult = 'accepted';
    if (this.#entries.length === this.#capacity) {
      this.#entries.shift();
      this.#droppedOldest += 1;
      result = 'accepted-after-drop';
    }
    this.#lastOrdinal += 1;
    this.#entries.push({
      ordinal: this.#lastOrdinal,
      enqueuedAt: now,
      expiresAt: now + this.#ttl,
      metrics: safe,
    });
    this.#accepted += 1;
    this.#highWaterMark = Math.max(this.#highWaterMark, this.length);
    return result;
  }

  /** Removes expired batches before returning one live batch, preserving original metric timestamps. */
  dequeue(now: number): readonly Metric[] | undefined {
    this.#validateTime(now);
    this.#expire(now);
    const entry = this.#entries.shift();
    if (entry !== undefined) this.#replayed += 1;
    return entry?.metrics;
  }

  /** Removes a batch only after a synchronous publish succeeds; thrown publication remains retryable. */
  replayOne(now: number, publish: (metrics: readonly Metric[]) => void): boolean {
    this.#validateTime(now);
    this.#expire(now);
    const entry = this.#entries[0];
    if (entry === undefined) return false;
    publish(structuredClone(entry.metrics));
    this.#entries.shift();
    this.#replayed += 1;
    return true;
  }

  /** Returns a deep-copy checkpoint payload; expiry is accounted at the capture time. */
  snapshot(now: number): Pick<Checkpoint, 'entries' | 'lastOrdinal'> {
    this.#validateTime(now);
    this.#expire(now);
    return structuredClone({ entries: this.#entries, lastOrdinal: this.#lastOrdinal });
  }

  /** Restores once, preserving expiry; capacity shrink follows the receiving queue's explicit policy. */
  restore(checkpoint: Checkpoint, now: number): RestoreResult {
    if (this.#used) throw new Error('restore requires a pristine queue');
    checkpoint = checkpointSchema.parse(checkpoint);
    this.#validateTime(now);
    if (now < checkpoint.capturedAt) throw new Error('checkpoint is from the future');
    const live = checkpoint.entries.filter((entry) => entry.expiresAt > now);
    const expired = checkpoint.entries.length - live.length;
    const capacityDropped = Math.max(0, live.length - this.#capacity);
    const retained =
      this.#policy === 'drop-oldest' ? live.slice(-this.#capacity) : live.slice(0, this.#capacity);
    this.#entries = structuredClone(retained);
    this.#lastOrdinal = checkpoint.lastOrdinal;
    this.#used = true;
    this.#lastTime = now;
    this.#expired = expired;
    this.#restored = retained.length;
    this.#highWaterMark = retained.length;
    this.#droppedOldest = this.#policy === 'drop-oldest' ? capacityDropped : 0;
    this.#rejectedNewest = this.#policy === 'reject-newest' ? capacityDropped : 0;
    return { restored: retained.length, expired, capacityDropped };
  }

  statistics(): RecoveryStatistics {
    return {
      accepted: this.#accepted,
      droppedOldest: this.#droppedOldest,
      highWaterMark: this.#highWaterMark,
      rejectedNewest: this.#rejectedNewest,
      expired: this.#expired,
      replayed: this.#replayed,
      restored: this.#restored,
    };
  }

  #validateTime(now: number): void {
    if (!Number.isSafeInteger(now) || now < this.#lastTime || now > 8_640_000_000_000_000)
      throw new Error('invalid or regressing queue clock');
  }
  #expire(now: number): void {
    const live = this.#entries.filter((entry) => entry.expiresAt > now);
    this.#expired += this.#entries.length - live.length;
    this.#entries = live;
    this.#lastTime = now;
  }
}
