/**
 * @file Full reliability campaign integration test.
 * @description Runs every scenario through node, broker, consumer, state store, and report boundaries.
 * @exports Vitest test cases only.
 */
import { describe, expect, it } from 'vitest';
import { runScenarioSuite } from '../../src/lab/scenario-suite.ts';

describe('lifecycle reliability campaign', () => {
  it('produces six passing scenarios with a valid final snapshot', () => {
    const report = runScenarioSuite('2026-01-15T12:00:00.000Z');
    expect(report.summary.failed).toBe(0);
    expect(report.scenarios).toHaveLength(6);
    expect(report.scenarios.every((scenario) => scenario.timeline.length >= 3)).toBe(true);
    expect(report.snapshot).toMatchObject([
      {
        groupId: 'plant-a',
        nodeId: 'edge-01',
        online: true,
      },
    ]);
  });
});
