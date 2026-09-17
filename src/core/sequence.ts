/**
 * @file Unsigned 8-bit sequence analysis.
 * @description Distinguishes in-order delivery, gaps, duplicates, and late packets across wraparound.
 * @exports SequenceAssessment, assessSequence.
 * @data HALF_RANGE applies serial-number arithmetic without treating old packets as enormous gaps.
 */

const MODULUS = 256;
const HALF_RANGE = MODULUS / 2;

export type SequenceAssessment =
  | { readonly kind: 'first' }
  | { readonly kind: 'next' }
  | { readonly kind: 'duplicate' }
  | { readonly kind: 'gap'; readonly missing: number }
  | { readonly kind: 'out-of-order'; readonly distanceBehind: number };

/**
 * Classifies a new sequence number relative to the most recently accepted value.
 *
 * @param previous - Last accepted sequence, or undefined before the first event.
 * @param current - Candidate unsigned 8-bit sequence.
 */
export function assessSequence(previous: number | undefined, current: number): SequenceAssessment {
  assertUint8(current, 'current');
  if (previous === undefined) {
    return { kind: 'first' };
  }

  assertUint8(previous, 'previous');
  const forwardDistance = (current - previous + MODULUS) % MODULUS;

  if (forwardDistance === 0) {
    return { kind: 'duplicate' };
  }
  if (forwardDistance === 1) {
    return { kind: 'next' };
  }
  if (forwardDistance < HALF_RANGE) {
    return { kind: 'gap', missing: forwardDistance - 1 };
  }
  return { distanceBehind: MODULUS - forwardDistance, kind: 'out-of-order' };
}

function assertUint8(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= MODULUS) {
    throw new RangeError(`${label} must be an unsigned 8-bit integer`);
  }
}
