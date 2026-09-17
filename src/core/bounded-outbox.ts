/**
 * @file Explicit bounded offline queue.
 * @description Prevents unbounded memory growth and exposes loss/backpressure decisions.
 * @exports BoundedOutbox, DropPolicy, OutboxStatistics, EnqueueResult.
 * @data items holds at most capacity entries; statistics records every overflow decision.
 */

export type DropPolicy = 'drop-oldest' | 'reject-newest';
export type EnqueueResult = 'accepted' | 'accepted-after-drop' | 'rejected';

export interface OutboxStatistics {
  readonly accepted: number;
  readonly droppedOldest: number;
  readonly highWaterMark: number;
  readonly rejectedNewest: number;
}

/** FIFO queue with a required capacity and observable overflow policy. */
export class BoundedOutbox<T> {
  readonly #capacity: number;
  readonly #items: T[] = [];
  readonly #policy: DropPolicy;
  #accepted = 0;
  #droppedOldest = 0;
  #highWaterMark = 0;
  #rejectedNewest = 0;

  constructor(capacity: number, policy: DropPolicy) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError('capacity must be a positive safe integer');
    }
    this.#capacity = capacity;
    this.#policy = policy;
  }

  get length(): number {
    return this.#items.length;
  }

  /** Adds an item according to the configured overflow policy. */
  enqueue(item: T): EnqueueResult {
    let result: EnqueueResult = 'accepted';
    if (this.#items.length === this.#capacity) {
      if (this.#policy === 'reject-newest') {
        this.#rejectedNewest += 1;
        return 'rejected';
      }
      this.#items.shift();
      this.#droppedOldest += 1;
      result = 'accepted-after-drop';
    }

    this.#items.push(item);
    this.#accepted += 1;
    this.#highWaterMark = Math.max(this.#highWaterMark, this.#items.length);
    return result;
  }

  /** Removes and returns the oldest item. */
  dequeue(): T | undefined {
    return this.#items.shift();
  }

  /** Returns a defensive snapshot for diagnostics and tests. */
  snapshot(): readonly T[] {
    return [...this.#items];
  }

  statistics(): OutboxStatistics {
    return {
      accepted: this.#accepted,
      droppedOldest: this.#droppedOldest,
      highWaterMark: this.#highWaterMark,
      rejectedNewest: this.#rejectedNewest,
    };
  }
}
