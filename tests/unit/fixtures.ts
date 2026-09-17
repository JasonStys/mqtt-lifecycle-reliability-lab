/**
 * @file Shared unit-test fixtures.
 * @description Builds valid lifecycle envelopes so individual tests change only relevant fields.
 * @exports envelopeFixture, metricFixture.
 * @data fixture timestamps and UUIDs are constant for reproducible assertions.
 */
import type { LifecycleEnvelope, Metric } from '../../src/core/contracts.ts';

export function metricFixture(overrides: Partial<Metric> = {}): Metric {
  return {
    dataType: 'float64',
    name: 'process.temperature',
    quality: 'good',
    sourceTimestamp: '2026-01-15T12:00:00.000Z',
    unit: 'celsius',
    value: 72.5,
    ...overrides,
  };
}

export function envelopeFixture(overrides: Partial<LifecycleEnvelope> = {}): LifecycleEnvelope {
  return {
    birthSequence: 1,
    event: 'birth',
    groupId: 'plant-a',
    messageId: '00000000-0000-4000-8000-000000000001',
    metrics: [metricFixture()],
    nodeId: 'edge-01',
    online: true,
    schemaVersion: '1.0',
    seq: 0,
    sourceTimestamp: '2026-01-15T12:00:00.000Z',
    ...overrides,
  };
}
