/**
 * @file Contract and topic boundary tests.
 * @description Ensures malformed input fails closed and canonical topics round-trip exactly.
 * @exports Vitest test cases only.
 */
import { describe, expect, it } from 'vitest';
import { parseEnvelope } from '../../src/core/contracts.ts';
import {
  buildGroupSubscription,
  buildLifecycleTopic,
  parseLifecycleTopic,
} from '../../src/core/topic.ts';
import { envelopeFixture } from './fixtures.ts';

describe('lifecycle contract', () => {
  it('parses a valid envelope from bytes', () => {
    const payload = new TextEncoder().encode(JSON.stringify(envelopeFixture()));
    expect(parseEnvelope(payload)).toMatchObject({ ok: true });
  });

  it('reports invalid JSON without throwing', () => {
    const result = parseEnvelope('{');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('invalid JSON');
    }
  });

  it('rejects mismatched value types, invalid birth sequence, and online death', () => {
    const wrongMetric = envelopeFixture({
      metrics: [
        {
          dataType: 'boolean',
          name: 'switch.open',
          quality: 'good',
          sourceTimestamp: '2026-01-15T12:00:00.000Z',
          value: 1,
        } as never,
      ],
    });
    expect(parseEnvelope(JSON.stringify(wrongMetric))).toMatchObject({ ok: false });
    expect(parseEnvelope(JSON.stringify(envelopeFixture({ seq: 2 })))).toMatchObject({ ok: false });
    expect(
      parseEnvelope(
        JSON.stringify(envelopeFixture({ event: 'death', online: true, reason: 'lost' })),
      ),
    ).toMatchObject({ ok: false });
  });
});

describe('topic helpers', () => {
  it('round-trips canonical identity and event segments', () => {
    const topic = buildLifecycleTopic({ event: 'data', groupId: 'plant-a', nodeId: 'edge-01' });
    expect(topic).toBe('reliability/v1/plant-a/nodes/edge-01/events/data');
    expect(parseLifecycleTopic(topic)).toEqual({
      event: 'data',
      groupId: 'plant-a',
      nodeId: 'edge-01',
    });
    expect(buildGroupSubscription('plant-a')).toBe('reliability/v1/plant-a/nodes/+/events/+');
  });

  it('rejects wildcards, malformed roots, extra segments, and unsafe identifiers', () => {
    expect(parseLifecycleTopic('reliability/v2/plant-a/nodes/edge-01/events/data')).toBeUndefined();
    expect(parseLifecycleTopic('reliability/v1/plant-a/nodes/+/events/data')).toBeUndefined();
    expect(
      parseLifecycleTopic('reliability/v1/plant-a/nodes/edge-01/events/data/extra'),
    ).toBeUndefined();
    expect(() =>
      buildLifecycleTopic({ event: 'data', groupId: 'Plant A', nodeId: 'edge-01' }),
    ).toThrow();
    expect(() => buildGroupSubscription('-plant')).toThrow();
  });
});
