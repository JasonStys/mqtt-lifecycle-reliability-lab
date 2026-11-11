/**
 * @file Independent offline workbench oracles and input/prefix/failure boundaries.
 * @description Exercises original lifecycle components with authored values, not expected outputs from target calculations.
 * @exports No public API; standard unit-test runner.
 * @data fixtures are fictional local-only telemetry; all result assertions name precise event/counter semantics.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_PROJECT_BYTES,
  parseProject,
  preparedProject,
  replayProject,
  runOriginalCampaign,
} from '../../src/workbench/campaign.ts';

describe('real original-engine campaign authoring', () => {
  it('expires one cold-chain batch, loses one on shrink and replays two original timestamps after replacement', () => {
    const project = preparedProject('cold-chain');
    const result = replayProject(project);
    expect(result.rejectedOperations).toBe(0);
    expect(result.rows[8]?.detail).toEqual({ restored: 2, expired: 1, capacityDropped: 1 });
    expect(result.publisher.birthSequence).toBe(2);
    expect(result.publisher.outbox).toMatchObject({
      restored: 2,
      replayed: 2,
      expired: 1,
      droppedOldest: 1,
    });
    expect(result.publisher.buffered).toBe(0);
    expect(result.snapshot[0]?.metrics['cargo.temperature']?.value).toBe(4.4);
    const actual = result.publications
      .filter((packet) => packet.topic.endsWith('/events/data'))
      .map(
        (packet) =>
          JSON.parse(packet.payload) as {
            seq: number;
            metrics: { value: number; sourceTimestamp: string }[];
          },
      );
    expect(actual.map((packet) => packet.seq)).toEqual([1, 2]);
    expect(actual.map((packet) => packet.metrics[0])).toMatchObject([
      { value: 4.3, sourceTimestamp: '2026-01-15T12:00:00.800Z' },
      { value: 4.4, sourceTimestamp: '2026-01-15T12:00:00.900Z' },
    ]);
  });

  it('late subscriber reconstructs retained state and duplicate injection is genuinely detected', () => {
    const project = preparedProject('factory');
    const late = replayProject(project, 3);
    expect(late.snapshot[0]?.metrics['line.speed']?.value).toBe(42);
    expect(late.observations.some((row) => row.retained)).toBe(true);
    const result = replayProject(project);
    expect(result.rejectedOperations).toBe(0);
    expect(result.statistics.duplicateMessages).toBe(1);
    expect(result.snapshot[0]?.metrics['line.speed']?.value).toBe(45);
    expect(result.snapshot[0]?.online).toBe(true);
    expect(result.publisher.birthSequence).toBe(2);
  });

  it('reject-newest keeps two earlier measurements and broker restart is distinct from publisher replacement', () => {
    const result = replayProject(preparedProject('utility'));
    expect(result.rejectedOperations).toBe(0);
    expect(result.rows[5]?.detail).toBe('rejected');
    expect(result.publisher.outbox.rejectedNewest).toBe(1);
    expect(result.publisher.outbox.replayed).toBe(2);
    expect(result.snapshot[0]?.metrics['flow.rate']?.value).toBe(202);
    expect(result.publisher.birthSequence).toBe(3);
    expect(result.rows[6]?.publisher.birthSequence).toBe(2);
    expect(result.rows[8]?.snapshot[0]?.online).toBe(false);
  });

  it('each prefix is isolated, deterministic and does not mutate the input or an earlier result', () => {
    const project = preparedProject('cold-chain');
    const bytes = JSON.stringify(project);
    const empty = replayProject(project, 0);
    expect(empty.rows).toEqual([]);
    expect(empty.snapshot).toEqual([]);
    const prefix = replayProject(project, 6);
    const first = JSON.stringify(prefix);
    const complete = replayProject(project);
    expect(complete.cursor).toBe(10);
    expect(JSON.stringify(prefix)).toBe(first);
    expect(replayProject(project, 6)).toEqual(prefix);
    expect(JSON.stringify(project)).toBe(bytes);
  });

  it('reports illegal event transitions without calling them successful or losing later recoverable work', () => {
    const project = preparedProject('factory');
    project.events = [
      { type: 'restore', atMs: 0 },
      { type: 'duplicate-last', atMs: 1 },
      { type: 'connect', atMs: 2 },
      { type: 'checkpoint', atMs: 3 },
      { type: 'disconnect', atMs: 4 },
      { type: 'checkpoint', atMs: 5 },
      { type: 'connect', atMs: 6 },
      { type: 'restore', atMs: 7 },
      { type: 'unsubscribe', atMs: 8 },
      { type: 'inspect', atMs: 9 },
    ];
    const result = replayProject(project);
    expect(result.rejectedOperations).toBe(4);
    expect(result.rows.filter((row) => row.outcome === 'rejected').map((row) => row.index)).toEqual(
      [0, 1, 3, 7],
    );
    expect(result.checkpoint).not.toBeNull();
    expect(result.publisher.connected).toBe(true);
  });

  it('allows deliberate retained-storage loss and fresh consumer without claiming recovered state', () => {
    const project = preparedProject('factory');
    project.events = [
      ...project.events.slice(0, 3),
      { type: 'restart-broker', atMs: 400, preserveRetained: false },
      { type: 'new-consumer', atMs: 500 },
    ];
    const result = replayProject(project);
    expect(result.snapshot).toEqual([]);
    expect(result.rows.at(-1)?.retainedMessages).toBe(0);
    expect(result.publisher.connected).toBe(false);
  });

  it('keeps the original seven-scenario suite authoritative and separately labeled', () => {
    const report = runOriginalCampaign();
    expect(report.summary).toEqual({ total: 7, passed: 7, failed: 0 });
    expect(report.profile.compatibility).toBe(
      'original-json-profile-not-sparkplug-wire-compatible',
    );
  });
});

describe('closed data-only input boundary', () => {
  it.each([
    ['title', ''],
    ['capacity', 0],
    ['capacity', 1_001],
    ['restoreCapacity', 0],
    ['ttlMs', 0],
    ['ttlMs', 86_400_001],
    ['overflowPolicy', 'unlimited'],
    ['nodeId', '../escape'],
    ['groupId', 'UPPER'],
    ['schema', 2],
    ['start', 'not-a-date'],
    ['start', '1960-01-01T00:00:00Z'],
    ['endpoint', 'https://external.invalid'],
    ['events', []],
    ['events', [{ type: 'execute', atMs: 0 }]],
  ])('rejects invalid or unknown %s before simulation', (key, value) => {
    expect(() =>
      parseProject(JSON.stringify({ ...preparedProject('factory'), [key]: value })),
    ).toThrow();
  });

  it('rejects oversized UTF-8 bytes, malformed JSON, event count/time/metric/unknown fields', () => {
    expect(() => parseProject('x'.repeat(MAX_PROJECT_BYTES + 1))).toThrow(/64 KiB/);
    expect(() => parseProject('😀'.repeat(MAX_PROJECT_BYTES / 4 + 1))).toThrow(/64 KiB/);
    expect(() => parseProject('{')).toThrow();
    const project = preparedProject('factory');
    expect(() =>
      parseProject(
        JSON.stringify({
          ...project,
          events: Array.from({ length: 129 }, () => ({ type: 'inspect', atMs: 0 })),
        }),
      ),
    ).toThrow();
    for (const events of [
      [
        { type: 'inspect', atMs: 2 },
        { type: 'inspect', atMs: 1 },
      ],
      [{ type: 'inspect', atMs: -1 }],
      [{ type: 'inspect', atMs: 86_400_001 }],
      [{ type: 'connect', atMs: 0, url: 'https://external.invalid' }],
      [{ type: 'publish', atMs: 0, metrics: [] }],
    ])
      expect(() => parseProject(JSON.stringify({ ...project, events }))).toThrow();
  });

  it.each([-1, 0.5, 11, Number.NaN])(
    'rejects a cursor outside exact event prefixes: %s',
    (cursor) => {
      expect(() => replayProject(preparedProject('cold-chain'), cursor)).toThrow(/cursor/);
    },
  );
});
