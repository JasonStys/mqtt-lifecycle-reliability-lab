/** @file Actual fixed-dependency notice and hardlink read regressions. @description No installed profiles or global changes. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  linkSync,
  readFileSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { lockedNotice } from '../../scripts/locked-notice.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'mqtt-notice-'));
  mkdirSync(join(root, 'node_modules/zod'), { recursive: true });
  return { root, license: join(root, 'node_modules/zod/LICENSE') };
}
test('genuine hardlinked dependency notice is read without changing either name or bytes', () => {
  const { root, license } = fixture();
  const outside = join(root, 'inert-owned-terms.txt');
  writeFileSync(outside, 'MIT License\nSynthetic owned terms.\n');
  linkSync(outside, license);
  assert.deepEqual(lockedNotice(root, 'zod'), readFileSync(outside));
  assert.equal(readFileSync(outside, 'utf8'), 'MIT License\nSynthetic owned terms.\n');
  assert.throws(() => lockedNotice(root, '../outside'));
});
test('ordinary and oversized fixed notice files obey actual byte bounds', () => {
  const { root, license } = fixture();
  writeFileSync(license, 'MIT');
  assert.equal(lockedNotice(root, 'zod').toString(), 'MIT');
  writeFileSync(license, 'x'.repeat(1_000_001));
  assert.throws(() => lockedNotice(root, 'zod'), /notice file/);
});
test('dependency directory alias cannot escape the fixed project dependency tree', () => {
  const root = mkdtempSync(join(tmpdir(), 'mqtt-notice-alias-'));
  const outside = mkdtempSync(join(tmpdir(), 'mqtt-outside-'));
  mkdirSync(join(root, 'node_modules'));
  writeFileSync(join(outside, 'LICENSE'), 'inert');
  symlinkSync(
    outside,
    join(root, 'node_modules/zod'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  assert.throws(() => lockedNotice(root, 'zod'), /escaped/);
});
