/**
 * @file Deterministic state-ingestion microbenchmark.
 * @description Measures validated message throughput and writes CI-comparable JSON evidence.
 * @exports No public exports; invoked by `pnpm benchmark`.
 * @data BENCHMARK_ITERATIONS controls sample size; MIN_THROUGHPUT_PER_SECOND is the regression gate.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LifecycleEnvelope } from './core/contracts.ts';
import { StateStore } from './core/state-store.ts';
import { buildLifecycleTopic } from './core/topic.ts';

const iterations = readPositiveInteger('BENCHMARK_ITERATIONS', 20_000);
const minimumThroughput = readPositiveInteger('MIN_THROUGHPUT_PER_SECOND', 5_000);
const store = new StateStore();
const birthTopic = buildLifecycleTopic({ event: 'birth', groupId: 'bench', nodeId: 'edge-01' });
const dataTopic = buildLifecycleTopic({ event: 'data', groupId: 'bench', nodeId: 'edge-01' });
const receivedAt = new Date('2026-01-15T12:00:00.000Z');

store.ingest(birthTopic, JSON.stringify(envelope(0, 0, 'birth')), receivedAt);
const start = performance.now();
for (let index = 1; index <= iterations; index += 1) {
  const result = store.ingest(
    dataTopic,
    JSON.stringify(envelope(index, index & 0xff, 'data')),
    receivedAt,
  );
  if (result.kind !== 'accepted') {
    throw new Error(`benchmark message ${index} was not accepted`);
  }
}
const elapsedMilliseconds = performance.now() - start;
const throughputPerSecond = (iterations / elapsedMilliseconds) * 1_000;
const report = {
  elapsedMilliseconds: Number(elapsedMilliseconds.toFixed(3)),
  iterations,
  minimumThroughputPerSecond: minimumThroughput,
  node: process.version,
  passed: throughputPerSecond >= minimumThroughput,
  throughputPerSecond: Number(throughputPerSecond.toFixed(0)),
};

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(repositoryRoot, 'artifacts/benchmark.json');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, undefined, 2)}\n`, 'utf8');
console.log(JSON.stringify(report));

if (!report.passed) {
  process.exitCode = 1;
}

function envelope(index: number, seq: number, event: 'birth' | 'data'): LifecycleEnvelope {
  return {
    birthSequence: 1,
    event,
    groupId: 'bench',
    messageId: `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0').slice(-12)}`,
    metrics: [
      {
        dataType: 'int64',
        name: 'counter.value',
        quality: 'good',
        sourceTimestamp: '2026-01-15T12:00:00.000Z',
        unit: 'count',
        value: index,
      },
    ],
    nodeId: 'edge-01',
    online: true,
    schemaVersion: '1.0',
    seq,
    sourceTimestamp: '2026-01-15T12:00:00.000Z',
  };
}

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}
