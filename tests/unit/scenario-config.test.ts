/**
 * @file Scenario-suite and environment configuration tests.
 * @description Checks complete fault evidence plus secret-safe configuration reporting.
 * @exports Vitest test cases only.
 */
import { describe, expect, it } from 'vitest';
import {
  createDeterministicClock,
  createDeterministicIdFactory,
} from '../../src/lab/determinism.ts';
import { runScenarioSuite } from '../../src/lab/scenario-suite.ts';
import { loadMqttConfiguration, publicConfiguration } from '../../src/mqtt/config.ts';

describe('deterministic helpers', () => {
  it('advances fixed time and IDs', () => {
    const clock = createDeterministicClock('2026-01-01T00:00:00.000Z', 1_000);
    expect(clock().toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(clock().toISOString()).toBe('2026-01-01T00:00:01.000Z');
    const ids = createDeterministicIdFactory(10);
    expect(ids()).toBe('00000000-0000-4000-8000-00000000000a');
    expect(() => createDeterministicClock('bad')).toThrow();
    expect(() => createDeterministicIdFactory(-1)).toThrow();
  });
});

describe('scenario suite', () => {
  it('passes all required reliability scenarios', () => {
    const report = runScenarioSuite('2026-01-15T12:00:00.000Z');
    expect(report.summary).toEqual({ failed: 0, passed: 6, total: 6 });
    expect(report.scenarios.map((scenario) => scenario.id)).toEqual([
      'retained-bootstrap',
      'lifecycle-recovery',
      'duplicate-and-ordering',
      'bounded-offline-buffer',
      'authorization-boundaries',
      'broker-restart',
    ]);
  });
});

describe('MQTT configuration', () => {
  it('validates settings and redacts the password from public diagnostics', () => {
    const configuration = loadMqttConfiguration({
      MQTT_PASSWORD: 'secret-value',
      MQTT_URL: 'mqtts://broker.example.test:8883',
      MQTT_USERNAME: 'edge',
    });
    expect(configuration.outboxCapacity).toBe(128);
    expect(JSON.stringify(publicConfiguration(configuration))).not.toContain('secret-value');
    expect(() => loadMqttConfiguration({ MQTT_URL: 'https://example.test' })).toThrow();
  });
});
