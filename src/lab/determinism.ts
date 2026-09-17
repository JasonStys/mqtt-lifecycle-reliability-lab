/**
 * @file Deterministic clocks and identifiers for reproducible scenarios.
 * @description Replaces wall-clock and random UUID dependencies during tests and report generation.
 * @exports createDeterministicClock, createDeterministicIdFactory.
 * @data tick advances simulated time; counter creates stable RFC 4122-shaped identifiers.
 */
import type { Clock, IdFactory } from './edge-node.ts';

/** Creates a clock that advances by a fixed duration on every read. */
export function createDeterministicClock(start: string, stepMilliseconds = 250): Clock {
  const startTime = Date.parse(start);
  if (!Number.isFinite(startTime) || stepMilliseconds < 0) {
    throw new Error('clock requires a valid start timestamp and non-negative step');
  }
  let tick = 0;
  return () => {
    const value = new Date(startTime + tick * stepMilliseconds);
    tick += 1;
    return value;
  };
}

/** Creates deterministic UUIDv4-shaped message identifiers. */
export function createDeterministicIdFactory(seed = 1): IdFactory {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new Error('identifier seed must be a non-negative safe integer');
  }
  let counter = seed;
  return () => {
    const suffix = counter.toString(16).padStart(12, '0').slice(-12);
    counter += 1;
    return `00000000-0000-4000-8000-${suffix}`;
  };
}
