/**
 * @file Scenario report command-line entry point.
 * @description Runs the deterministic lab and writes machine-readable evidence for CI and dashboard.
 * @exports No public exports; invoked by `pnpm scenario`.
 * @data output paths are repository-local and contain no credentials.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScenarioSuite } from './lab/scenario-suite.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const report = runScenarioSuite();
const serialized = `${JSON.stringify(report, undefined, 2)}\n`;
const outputs = [
  resolve(repositoryRoot, 'artifacts/lab-report.json'),
  resolve(repositoryRoot, 'dashboard/public/lab-report.json'),
];

await Promise.all(outputs.map((output) => mkdir(dirname(output), { recursive: true })));
await Promise.all(outputs.map((output) => writeFile(output, serialized, 'utf8')));

console.log(
  `Reliability scenarios: ${report.summary.passed}/${report.summary.total} passed; report written to artifacts/lab-report.json`,
);

if (report.summary.failed > 0) {
  process.exitCode = 1;
}
