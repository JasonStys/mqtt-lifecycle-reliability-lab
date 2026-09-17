/**
 * @file Bounded outbox unit tests.
 * @description Verifies capacity validation, FIFO order, and both explicit overflow policies.
 * @exports Vitest test cases only.
 */
import { describe, expect, it } from 'vitest';
import { BoundedOutbox } from '../../src/core/bounded-outbox.ts';

describe('BoundedOutbox', () => {
  it('rejects invalid capacity', () => {
    expect(() => new BoundedOutbox(0, 'drop-oldest')).toThrow(RangeError);
    expect(() => new BoundedOutbox(1.5, 'drop-oldest')).toThrow(RangeError);
  });

  it('drops the oldest item and records observable statistics', () => {
    const outbox = new BoundedOutbox<number>(2, 'drop-oldest');
    expect(outbox.enqueue(1)).toBe('accepted');
    expect(outbox.enqueue(2)).toBe('accepted');
    expect(outbox.enqueue(3)).toBe('accepted-after-drop');
    expect(outbox.snapshot()).toEqual([2, 3]);
    expect(outbox.dequeue()).toBe(2);
    expect(outbox.statistics()).toEqual({
      accepted: 3,
      droppedOldest: 1,
      highWaterMark: 2,
      rejectedNewest: 0,
    });
  });

  it('rejects newest items without changing existing FIFO contents', () => {
    const outbox = new BoundedOutbox<string>(1, 'reject-newest');
    expect(outbox.enqueue('first')).toBe('accepted');
    expect(outbox.enqueue('second')).toBe('rejected');
    expect(outbox.snapshot()).toEqual(['first']);
    expect(outbox.statistics().rejectedNewest).toBe(1);
  });
});
