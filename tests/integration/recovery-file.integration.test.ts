/**
 * @file Actual private-file checkpoint recovery integration test.
 * @description Writes/reads bytes in a unique temporary directory then checks the independent lab consumer.
 * @exports Vitest tests; directory is cleaned only after its resolved test-owned path is known.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { prepareRecoveryRehearsal } from '../../src/lab/recovery-rehearsal.ts';

it('recovers only live capacity-surviving measurements from actual saved checkpoint bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mqtt-recovery-test-'));
  try {
    const fixture = prepareRecoveryRehearsal();
    const file = join(directory, 'checkpoint.json');
    await writeFile(file, fixture.checkpoint, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    const result = fixture.recover(await readFile(file, 'utf8'));
    expect(result.passed).toBe(true);
    expect(result.restore).toEqual({ restored: 2, expired: 1, capacityDropped: 1 });
    expect(result.replayed.map((event) => event.metrics[0]?.value)).toEqual([4.3, 4.4]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
