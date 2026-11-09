/**
 * @file Private-file recovery rehearsal command; symbols: docs/code-map.md.
 * @description Writes a new checkpoint in an ignored unique directory, reads it back, and verifies broker recovery.
 * @exports No public API; invoked with pnpm recovery.
 * @data directory is repository-local; mode 0600 requests owner-only file permissions where the OS supports it.
 */
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareRecoveryRehearsal } from './lab/recovery-rehearsal.ts';

const root = resolve(import.meta.dirname, '..', 'artifacts');
mkdirSync(root, { recursive: true });
const directory = await mkdtemp(resolve(root, 'recovery-'));
const rehearsal = prepareRecoveryRehearsal();
const checkpointPath = resolve(directory, 'checkpoint.json');
await writeFile(checkpointPath, rehearsal.checkpoint, {
  encoding: 'utf8',
  flag: 'wx',
  mode: 0o600,
});
const report = rehearsal.recover(await readFile(checkpointPath, 'utf8'));
await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n', {
  encoding: 'utf8',
  flag: 'wx',
  mode: 0o600,
});
console.log(JSON.stringify({ directory, ...report }, null, 2));
if (!report.passed) process.exitCode = 1;
