/** File: desktop/tests/profile.test.cjs
 * Purpose: Actual inert filesystem authoring/profile/revision/recovery refusal tests, separate from browser/native claims.
 * State: new temporary roots only; real hardlink and Windows junction sentinels remain unchanged.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const { join } = require('node:path');
const { openProfile, admittedPath } = require('../profile.cjs');
const { readRegular } = require('../files.cjs');
const fresh = () => fs.mkdtempSync(join(os.tmpdir(), 'mlw-profile-contract-'));
const identity = {
  schema: 1,
  product: 'mqtt-lifecycle-reliability-lab',
  id: 'a'.repeat(32),
};

test('real model save, stale revision, previous bytes and cold reopen preserve the actual authored project', async () => {
  const { parseProject, preparedProject } = await import('../../src/workbench/campaign.ts');
  const root = fresh(),
    profile = openProfile(join(root, 'workspace'), parseProject);
  assert.deepEqual(profile.load(), { revision: 'none', project: null });
  const first = profile.save({
    revision: 'none',
    serialized: JSON.stringify(preparedProject('factory')),
  });
  assert.equal(first.project.title, 'Factory late subscriber and duplicate delivery');
  const original = fs.readFileSync(join(profile.directory, 'project.json'));
  assert.throws(
    () =>
      profile.save({
        revision: 'none',
        serialized: JSON.stringify(preparedProject('cold-chain')),
      }),
    /changed/,
  );
  assert.throws(() => profile.save({ revision: first.revision, serialized: '{"schema":999}' }));
  assert.deepEqual(fs.readFileSync(join(profile.directory, 'project.json')), original);
  const second = profile.save({
    revision: first.revision,
    serialized: JSON.stringify(preparedProject('utility')),
  });
  assert.equal(second.project.title, 'Utility reject-newest outage and broker restart');
  assert.deepEqual(fs.readFileSync(join(profile.directory, 'project.previous.json')), original);
  assert.throws(() => openProfile(profile.directory, parseProject), /owned|lock/);
  profile.close();
  profile.close();
  const restarted = openProfile(profile.directory, parseProject);
  assert.deepEqual(restarted.load(), second);
  restarted.close();
});

test('unknown nonempty, malformed markers and interrupted temporary evidence are preserved', () => {
  for (const name of ['not-our-app.txt', 'pending-' + 'a'.repeat(32) + '.json']) {
    const root = fresh();
    fs.writeFileSync(join(root, name), 'sentinel');
    assert.throws(() => openProfile(root, JSON.parse));
    assert.deepEqual(fs.readdirSync(root), [name]);
    assert.equal(fs.readFileSync(join(root, name), 'utf8'), 'sentinel');
  }
  const root = fresh();
  fs.writeFileSync(join(root, 'workspace-owner.json'), '{}');
  assert.throws(() => openProfile(root, JSON.parse));
  assert.equal(fs.existsSync(join(root, 'workspace.lock')), false);
});

test('actual existing hardlinked mutable slots are refused before any profile write', () => {
  for (const name of [
    'workspace-owner.json',
    'workspace.lock',
    'project.json',
    'project.previous.json',
  ]) {
    const root = fresh(),
      profile = join(root, 'workspace'),
      outside = join(root, 'outside.txt');
    fs.mkdirSync(profile);
    fs.writeFileSync(
      outside,
      name === 'workspace-owner.json' ? JSON.stringify(identity) : 'retained-outside',
    );
    if (name !== 'workspace-owner.json')
      fs.writeFileSync(join(profile, 'workspace-owner.json'), JSON.stringify(identity));
    fs.linkSync(outside, join(profile, name));
    const before = fs.readFileSync(outside),
      entries = fs.readdirSync(profile);
    assert.throws(() => openProfile(profile, JSON.parse));
    assert.deepEqual(fs.readFileSync(outside), before);
    assert.deepEqual(fs.readdirSync(profile), entries);
  }
});

test('actual directory alias ancestors and complete program directories are refused before mkdir', () => {
  const root = fresh(),
    actual = join(root, 'actual'),
    alias = join(root, 'alias');
  fs.mkdirSync(actual);
  fs.symlinkSync(actual, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => admittedPath(join(alias, 'new')));
  assert.deepEqual(fs.readdirSync(actual), []);
  assert.throws(() =>
    admittedPath(join(root, 'installation', 'nested'), [join(root, 'installation')]),
  );
  assert.equal(fs.existsSync(join(root, 'installation')), false);
  assert.throws(() => admittedPath('relative'));
});

test('newly introduced alias after opening cannot replace current or previous bytes on save', () => {
  const root = fresh(),
    profile = openProfile(join(root, 'workspace'), JSON.parse);
  const saved = profile.save({
    revision: 'none',
    serialized: '{"title":"original"}',
  });
  const outside = join(root, 'outside.json');
  fs.writeFileSync(outside, 'outside');
  fs.linkSync(outside, join(profile.directory, 'project.previous.json'));
  assert.throws(() => profile.save({ revision: saved.revision, serialized: '{"title":"new"}' }));
  assert.equal(fs.readFileSync(outside, 'utf8'), 'outside');
  assert.equal(
    JSON.parse(fs.readFileSync(join(profile.directory, 'project.json'))).title,
    'original',
  );
  // Retain the admitted-owner lock because the namespace changed; no unsafe cleanup is attempted.
});

test('bounded descriptor reads reject special, oversized and actual hardlinked inputs', () => {
  const root = fresh(),
    file = join(root, 'inert.json'),
    alias = join(root, 'alias.json');
  fs.writeFileSync(file, 'abcde');
  assert.equal(readRegular(file, 5).toString(), 'abcde');
  assert.throws(() => readRegular(file, 4));
  assert.throws(() => readRegular(root, 100));
  fs.linkSync(file, alias);
  assert.throws(() => readRegular(alias, 100));
  assert.equal(fs.readFileSync(file, 'utf8'), 'abcde');
});
