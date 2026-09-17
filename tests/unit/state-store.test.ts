/**
 * @file State reconstruction unit tests.
 * @description Verifies rejection paths, anomaly counters, clock skew, snapshots, and dedupe bounds.
 * @exports Vitest test cases only.
 */
import { describe, expect, it } from 'vitest';
import { StateStore } from '../../src/core/state-store.ts';
import { buildLifecycleTopic } from '../../src/core/topic.ts';
import { envelopeFixture, metricFixture } from './fixtures.ts';

const receivedAt = new Date('2026-01-15T12:00:01.000Z');
const topic = buildLifecycleTopic({ event: 'birth', groupId: 'plant-a', nodeId: 'edge-01' });

describe('StateStore', () => {
  it('rejects invalid topics, invalid payloads, identity mismatches, and orphan data', () => {
    const store = new StateStore();
    expect(store.ingest('invalid', '{}', receivedAt).kind).toBe('rejected');
    expect(store.ingest(topic, '{', receivedAt).kind).toBe('rejected');
    expect(
      store.ingest(topic, JSON.stringify(envelopeFixture({ nodeId: 'edge-02' })), receivedAt).kind,
    ).toBe('rejected');
    const dataTopic = buildLifecycleTopic({ event: 'data', groupId: 'plant-a', nodeId: 'edge-01' });
    expect(
      store.ingest(
        dataTopic,
        JSON.stringify(envelopeFixture({ event: 'data', messageId: uuid(2), seq: 1 })),
        receivedAt,
      ).kind,
    ).toBe('rejected');
    expect(store.statistics()).toMatchObject({ invalid: 4, orphanData: 1 });
  });

  it('deduplicates message IDs, records gaps, and prevents late state rollback', () => {
    const store = new StateStore();
    const birth = envelopeFixture();
    expect(store.ingest(topic, JSON.stringify(birth), receivedAt).kind).toBe('accepted');
    expect(store.ingest(topic, JSON.stringify(birth), receivedAt).kind).toBe('duplicate-message');

    const dataTopic = buildLifecycleTopic({ event: 'data', groupId: 'plant-a', nodeId: 'edge-01' });
    const gap = envelopeFixture({
      event: 'data',
      messageId: uuid(2),
      metrics: [metricFixture({ value: 80 })],
      seq: 3,
    });
    expect(store.ingest(dataTopic, JSON.stringify(gap), receivedAt)).toMatchObject({
      kind: 'accepted',
      sequence: { kind: 'gap', missing: 2 },
    });

    const late = envelopeFixture({
      event: 'data',
      messageId: uuid(3),
      metrics: [metricFixture({ value: 70 })],
      seq: 2,
    });
    expect(store.ingest(dataTopic, JSON.stringify(late), receivedAt)).toMatchObject({
      kind: 'accepted',
      sequence: { kind: 'out-of-order' },
    });
    expect(store.getNode('plant-a', 'edge-01')?.metrics['process.temperature']?.value).toBe(80);
    expect(store.statistics()).toMatchObject({
      duplicateMessages: 1,
      gaps: 1,
      missingMessages: 2,
      outOfOrder: 1,
    });
  });

  it('flags clock skew, handles sequence duplicates, and returns defensive sorted snapshots', () => {
    const store = new StateStore();
    const skewedBirth = envelopeFixture({ sourceTimestamp: '2026-01-15T00:00:00.000Z' });
    const result = store.ingest(topic, JSON.stringify(skewedBirth), receivedAt);
    expect(result.kind).toBe('accepted');
    if (result.kind === 'accepted') {
      expect(result.warning).toContain('five minutes');
    }
    const dataTopic = buildLifecycleTopic({ event: 'data', groupId: 'plant-a', nodeId: 'edge-01' });
    const duplicateSequence = envelopeFixture({ event: 'data', messageId: uuid(4), seq: 0 });
    expect(store.ingest(dataTopic, JSON.stringify(duplicateSequence), receivedAt)).toMatchObject({
      sequence: { kind: 'duplicate' },
    });
    const snapshot = store.snapshot();
    expect(snapshot).toHaveLength(1);
    expect(store.statistics()).toMatchObject({ clockSkewWarnings: 1, duplicateSequences: 1 });
  });

  it('evicts old dedupe IDs when the configured bound is exceeded', () => {
    const store = new StateStore(1);
    const birth = envelopeFixture();
    store.ingest(topic, JSON.stringify(birth), receivedAt);
    const stateTopic = buildLifecycleTopic({
      event: 'state',
      groupId: 'plant-a',
      nodeId: 'edge-01',
    });
    const state = envelopeFixture({ event: 'state', messageId: uuid(5) });
    store.ingest(stateTopic, JSON.stringify(state), receivedAt);
    expect(store.ingest(topic, JSON.stringify(birth), receivedAt).kind).toBe('accepted');
    expect(() => new StateStore(0)).toThrow(RangeError);
  });
});

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`;
}
