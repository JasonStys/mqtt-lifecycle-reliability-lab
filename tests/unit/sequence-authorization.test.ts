/**
 * @file Sequence arithmetic and ACL policy tests.
 * @description Covers wraparound, anomaly classes, least privilege, and deny-by-default behavior.
 * @exports Vitest test cases only.
 */
import { describe, expect, it } from 'vitest';
import { AuthorizationPolicy } from '../../src/core/authorization.ts';
import { assessSequence } from '../../src/core/sequence.ts';
import { buildLifecycleTopic } from '../../src/core/topic.ts';

describe('assessSequence', () => {
  it.each([
    [undefined, 0, { kind: 'first' }],
    [7, 8, { kind: 'next' }],
    [255, 0, { kind: 'next' }],
    [7, 7, { kind: 'duplicate' }],
    [7, 10, { kind: 'gap', missing: 2 }],
    [10, 8, { kind: 'out-of-order', distanceBehind: 2 }],
  ] as const)('classifies previous=%s current=%s', (previous, current, expected) => {
    expect(assessSequence(previous, current)).toEqual(expected);
  });

  it('rejects values outside an unsigned byte', () => {
    expect(() => assessSequence(0, 256)).toThrow(RangeError);
    expect(() => assessSequence(-1, 0)).toThrow(RangeError);
  });
});

describe('AuthorizationPolicy', () => {
  const policy = new AuthorizationPolicy();
  const ownTopic = buildLifecycleTopic({ event: 'data', groupId: 'plant-a', nodeId: 'edge-01' });

  it('allows only a node owner to publish', () => {
    expect(
      policy.authorizePublish({ groupId: 'plant-a', nodeId: 'edge-01', role: 'node' }, ownTopic)
        .allowed,
    ).toBe(true);
    expect(
      policy.authorizePublish({ groupId: 'plant-a', nodeId: 'edge-02', role: 'node' }, ownTopic)
        .allowed,
    ).toBe(false);
    expect(policy.authorizePublish({ role: 'unknown' }, ownTopic).allowed).toBe(false);
    expect(policy.authorizePublish({ role: 'unknown' }, 'outside/topic').allowed).toBe(false);
  });

  it('allows only the exact group-scoped consumer filter', () => {
    const consumer = { groupId: 'plant-a', role: 'consumer' } as const;
    expect(
      policy.authorizeSubscribe(consumer, 'reliability/v1/plant-a/nodes/+/events/+').allowed,
    ).toBe(true);
    expect(policy.authorizeSubscribe(consumer, 'reliability/v1/+/nodes/+/events/+').allowed).toBe(
      false,
    );
    expect(policy.authorizeSubscribe({ role: 'unknown' }, '#').allowed).toBe(false);
  });
});
